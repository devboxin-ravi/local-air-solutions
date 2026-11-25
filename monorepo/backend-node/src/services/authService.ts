/**
 * Authentication: password login with lockout, optional OTP, JWT access tokens,
 * refresh-token rotation with reuse detection, password reset, customer registration.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OtpPurpose } from '@prisma/client';
import { config } from '../config';
import { ADMIN_SESSION_FAMILY_PREFIX, AuthClients, COMPANY_WIDE_ROLES, ErrorCodes, ErrorMessages, NumberPrefixes, RoleCodes, AuditActions, type AuthClient } from '../constants';
import { AuthRepository, UserWithAccess } from '../repositories/authRepository';
import { UserRepository } from '../repositories/userRepository';
import { CustomerRepository } from '../repositories/customerRepository';
import { nextSequence, runInTransaction } from '../repositories/db';
import type { AccessTokenPayload, AuthUser, RequestMeta, TokenPair } from '../models';
import { AppError, ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '../utils/errors';
import { StatusCodes } from '../constants/api';
import { formatCode, generateOtp, randomToken, sha256 } from '../utils/helpers';
import { logger } from '../utils/logger';
import { EmailProvider } from './deliveryProviders';
import { SettingsService } from './settingsService';
import type { RegisterCustomerInput, UpdateMeInput } from '../validations/auth';
import type { CustomerService } from './customerService';

const AUTH_CACHE_TTL_MS = 15_000;
/** Valid bcrypt hash used to equalize timing when the user does not exist. */
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-password', 10);

export class AuthService {
  private cache = new Map<number, { user: AuthUser; at: number }>();

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly userRepo: UserRepository,
    private readonly customerRepo: CustomerRepository,
    private readonly settings: SettingsService,
    private readonly email: EmailProvider,
    private readonly customers: CustomerService,
  ) {}

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  toAuthUser(u: UserWithAccess): AuthUser {
    const roles = u.roles.map((r) => r.role.code);
    const permissions = Array.from(new Set(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))));
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      userType: u.userType,
      roles,
      permissions,
      branchId: u.branchId ?? u.staffProfile?.branchId ?? null,
      isSuperAdmin: roles.includes(RoleCodes.SUPER_ADMIN),
      isCompanyWide: roles.some((r) => COMPANY_WIDE_ROLES.includes(r)),
      customerId: u.customer?.id ?? null,
      staffId: u.staffProfile?.id ?? null,
    };
  }

  /** Verifies an access token and loads the principal (short in-memory cache). */
  async authenticate(token: string): Promise<AuthUser> {
    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret, { issuer: config.jwt.issuer }) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new UnauthorizedError(ErrorMessages.TOKEN_EXPIRED, ErrorCodes.TOKEN_EXPIRED);
      throw new UnauthorizedError(ErrorMessages.TOKEN_INVALID, ErrorCodes.TOKEN_INVALID);
    }
    const id = Number(payload.sub);
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.at < AUTH_CACHE_TTL_MS) return cached.user;
    const u = await this.authRepo.findByIdWithAccess(id);
    if (!u || u.status !== 'ACTIVE') throw new UnauthorizedError(ErrorMessages.TOKEN_INVALID, ErrorCodes.TOKEN_INVALID);
    const user = this.toAuthUser(u);
    this.cache.set(id, { user, at: Date.now() });
    return user;
  }

  invalidateCache(userId?: number): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }

  private signAccess(user: { id: number; userType: AccessTokenPayload['typ'] }) {
    const expiresAt = new Date(Date.now() + config.jwt.accessExpiresMinutes * 60_000);
    const token = jwt.sign({ sub: String(user.id), typ: user.userType } satisfies AccessTokenPayload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresMinutes * 60,
      issuer: config.jwt.issuer,
    });
    return { token, expiresAt };
  }

  /**
   * Issues an access + refresh pair. A new admin-panel session gets a family id marked with
   * ADMIN_SESSION_FAMILY_PREFIX and a fixed lifetime; rotations pass `fixedExpiry` to keep it.
   */
  private async issueTokens(
    userId: number,
    userType: AccessTokenPayload['typ'],
    meta: RequestMeta,
    opts: { familyId?: string; client?: AuthClient; fixedExpiry?: Date } = {},
  ): Promise<TokenPair & { refreshId: number }> {
    const access = this.signAccess({ id: userId, userType });
    const refresh = randomToken();
    const adminPanel = opts.client === AuthClients.ADMIN_PANEL;
    const days = adminPanel ? config.jwt.adminSessionDays : config.jwt.refreshExpiresDays;
    const refreshExpires = opts.fixedExpiry ?? new Date(Date.now() + days * 86_400_000);
    const row = await this.authRepo.createRefreshToken({
      userId,
      tokenHash: sha256(refresh),
      familyId: opts.familyId ?? (adminPanel ? ADMIN_SESSION_FAMILY_PREFIX : '') + randomToken(24),
      expiresAt: refreshExpires,
      userAgent: meta.userAgent?.slice(0, 500),
      ipAddress: meta.ip,
    });
    return {
      accessToken: access.token,
      refreshToken: refresh,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: refreshExpires.toISOString(),
      refreshId: row.id,
    };
  }

  private async assertCanLogin(u: UserWithAccess | null, password: string) {
    if (!u || !u.passwordHash) {
      // Equalize timing to avoid user enumeration.
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedError(ErrorMessages.INVALID_CREDENTIALS, ErrorCodes.INVALID_CREDENTIALS);
    }
    if (u.lockedUntil && u.lockedUntil > new Date()) {
      const mins = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new AppError(ErrorMessages.ACCOUNT_LOCKED(mins), StatusCodes.LOCKED, ErrorCodes.ACCOUNT_LOCKED);
    }
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) {
      const failed = u.failedLoginCount + 1;
      const lock = failed >= config.security.loginMaxAttempts ? new Date(Date.now() + config.security.loginLockMinutes * 60_000) : null;
      await this.authRepo.recordFailedLogin(u.id, lock ? 0 : failed, lock);
      if (lock) throw new AppError(ErrorMessages.ACCOUNT_LOCKED(config.security.loginLockMinutes), StatusCodes.LOCKED, ErrorCodes.ACCOUNT_LOCKED);
      throw new UnauthorizedError(ErrorMessages.INVALID_CREDENTIALS, ErrorCodes.INVALID_CREDENTIALS);
    }
    if (u.status !== 'ACTIVE') throw new AppError(ErrorMessages.ACCOUNT_INACTIVE, StatusCodes.FORBIDDEN, ErrorCodes.ACCOUNT_INACTIVE);
  }

  /**
   * Password login. `audience` restricts which user types may sign in to a given app.
   * When OTP is enabled, returns `{ otpRequired: true }` and sends an OTP instead of tokens.
   */
  async login(identifier: string, password: string, audience: Array<'ADMIN' | 'STAFF' | 'CUSTOMER'>, meta: RequestMeta, client: AuthClient = AuthClients.APP) {
    const u = await this.authRepo.findByIdentifier(identifier.trim().toLowerCase());
    await this.assertCanLogin(u, password);
    const user = u as UserWithAccess;
    if (!audience.includes(user.userType)) throw new UnauthorizedError(ErrorMessages.INVALID_CREDENTIALS, ErrorCodes.INVALID_CREDENTIALS);

    if (config.security.otpEnabled) {
      await this.sendOtp(user, 'LOGIN');
      return { otpRequired: true as const, userId: user.id };
    }
    return this.completeLogin(user, meta, client);
  }

  private async completeLogin(u: UserWithAccess, meta: RequestMeta, client: AuthClient = AuthClients.APP) {
    await this.authRepo.recordSuccessfulLogin(u.id);
    const tokens = await this.issueTokens(u.id, u.userType, meta, { client });
    await this.settings.audit({ id: u.id } as AuthUser, AuditActions.LOGIN, 'user', u.id, null, null, meta);
    const { refreshId: _r, ...pair } = tokens;
    return { otpRequired: false as const, tokens: pair, user: this.toAuthUser(u) };
  }

  async verifyLoginOtp(userId: number, code: string, meta: RequestMeta, client: AuthClient = AuthClients.APP) {
    await this.consumeOtp(userId, 'LOGIN', code);
    const u = await this.authRepo.findByIdWithAccess(userId);
    if (!u) throw new UnauthorizedError(ErrorMessages.OTP_INVALID, ErrorCodes.OTP_INVALID);
    return this.completeLogin(u, meta, client);
  }

  /** Rotation with reuse detection: presenting a revoked token revokes the whole family. */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    const row = await this.authRepo.findRefreshToken(sha256(refreshToken));
    if (!row) throw new UnauthorizedError(ErrorMessages.TOKEN_INVALID, ErrorCodes.TOKEN_INVALID);
    if (row.revokedAt) {
      await this.authRepo.revokeFamily(row.familyId);
      logger.warn('Refresh token reuse detected', { userId: row.userId });
      throw new UnauthorizedError(ErrorMessages.REFRESH_REUSED, ErrorCodes.TOKEN_INVALID);
    }
    if (row.expiresAt < new Date()) throw new UnauthorizedError(ErrorMessages.TOKEN_EXPIRED, ErrorCodes.TOKEN_EXPIRED);
    const u = await this.authRepo.findByIdWithAccess(row.userId);
    if (!u || u.status !== 'ACTIVE') throw new UnauthorizedError(ErrorMessages.TOKEN_INVALID, ErrorCodes.TOKEN_INVALID);
    // Admin-panel sessions keep their original end date; app sessions slide forward.
    const fixedExpiry = row.familyId.startsWith(ADMIN_SESSION_FAMILY_PREFIX) ? row.expiresAt : undefined;
    const next = await this.issueTokens(u.id, u.userType, meta, { familyId: row.familyId, fixedExpiry });
    await this.authRepo.markRefreshTokenReplaced(row.id, next.refreshId);
    const { refreshId: _r, ...pair } = next;
    return pair;
  }

  async logout(refreshToken: string | undefined, actor: AuthUser | undefined, meta: RequestMeta): Promise<void> {
    if (refreshToken) {
      const row = await this.authRepo.findRefreshToken(sha256(refreshToken));
      if (row && !row.revokedAt) await this.authRepo.revokeRefreshToken(row.id);
    }
    if (actor) await this.settings.audit(actor, AuditActions.LOGOUT, 'user', actor.id, null, null, meta);
  }

  async logoutAll(actor: AuthUser): Promise<void> {
    await this.authRepo.revokeAllForUser(actor.id);
  }

  sessions(actor: AuthUser) {
    return this.authRepo.listActiveSessions(actor.id);
  }

  async me(actor: AuthUser) {
    const u = await this.authRepo.findByIdWithAccess(actor.id);
    if (!u) throw new UnauthorizedError();
    return { ...this.toAuthUser(u), username: u.username, avatarUrl: u.avatarUrl, countryCode: u.countryCode, lastLoginAt: u.lastLoginAt };
  }

  /** Staff / admin update their own name, email, mobile and username (each must stay unique). */
  async updateMe(actor: AuthUser, input: UpdateMeInput) {
    const u = await this.authRepo.findByIdWithAccess(actor.id);
    if (!u) throw new UnauthorizedError();
    if (u.userType === 'CUSTOMER') throw new ForbiddenError();
    if (input.mobile !== u.mobile && (await this.userRepo.findByMobile(input.mobile))) throw new ConflictError(ErrorMessages.MOBILE_IN_USE);
    if (input.email && input.email !== u.email && (await this.userRepo.findByEmail(input.email))) throw new ConflictError(ErrorMessages.EMAIL_IN_USE);
    if (input.username && input.username !== u.username && (await this.userRepo.findByUsername(input.username))) throw new ConflictError(ErrorMessages.USERNAME_IN_USE);
    if (!input.email && !input.username && u.roles.some((r) => r.role.code !== RoleCodes.TECHNICIAN)) {
      // Admin-panel sign-in uses username or email — keep at least one.
      throw new ValidationError(ErrorMessages.ADMIN_LOGIN_ID_REQUIRED);
    }
    await this.userRepo.update(actor.id, { name: input.name, email: input.email, mobile: input.mobile, username: input.username });
    this.invalidateCache(actor.id);
    return this.me(actor);
  }

  /** Sets (or clears, with null) the signed-in user's profile picture. */
  async setAvatar(actor: AuthUser, avatarUrl: string | null): Promise<{ avatarUrl: string | null }> {
    const updated = await this.authRepo.updateAvatar(actor.id, avatarUrl);
    this.invalidateCache(actor.id);
    return { avatarUrl: updated.avatarUrl };
  }

  async changePassword(actor: AuthUser, current: string, next: string): Promise<void> {
    const u = await this.authRepo.findByIdWithAccess(actor.id);
    if (!u?.passwordHash || !(await bcrypt.compare(current, u.passwordHash))) throw new ValidationError(ErrorMessages.PASSWORD_MISMATCH);
    await this.authRepo.updatePasswordHash(actor.id, await this.hashPassword(next));
    await this.authRepo.revokeAllForUser(actor.id);
  }

  // ─── OTP & password reset ───
  private async sendOtp(u: { id: number; email: string | null; mobile: string; name: string }, purpose: OtpPurpose): Promise<void> {
    const code = generateOtp();
    await this.authRepo.invalidateOtps(u.id, purpose);
    await this.authRepo.createOtp({
      userId: u.id,
      purpose,
      codeHash: sha256(`${u.id}:${code}`),
      expiresAt: new Date(Date.now() + config.security.otpExpiresMinutes * 60_000),
    });
    if (this.email.enabled && u.email) {
      await this.email
        .send(u.email, 'Your Local Air Solutions verification code', `Hello ${u.name},\n\nYour verification code is ${code}. It expires in ${config.security.otpExpiresMinutes} minutes.\n\nIf you did not request this, ignore this email.`)
        .catch((e) => logger.error('OTP email failed', { error: (e as Error).message }));
    } else if (!config.isProduction) {
      // Development only: no SMS/email provider configured — surface OTP in server logs.
      logger.info('DEV OTP (no delivery channel configured)', { userId: u.id, purpose, code });
    }
  }

  private async consumeOtp(userId: number, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.authRepo.findLatestOtp(userId, purpose);
    if (!otp || otp.attempts >= config.security.otpMaxAttempts) throw new UnauthorizedError(ErrorMessages.OTP_INVALID, ErrorCodes.OTP_INVALID);
    if (otp.codeHash !== sha256(`${userId}:${code}`)) {
      await this.authRepo.incrementOtpAttempts(otp.id);
      throw new UnauthorizedError(ErrorMessages.OTP_INVALID, ErrorCodes.OTP_INVALID);
    }
    await this.authRepo.consumeOtp(otp.id);
  }

  /** Always responds identically whether or not the account exists (no enumeration). */
  async forgotPassword(identifier: string): Promise<{ userId?: number }> {
    const u = await this.authRepo.findByIdentifier(identifier.trim().toLowerCase());
    if (u && u.status === 'ACTIVE') {
      await this.sendOtp(u, 'PASSWORD_RESET');
      return { userId: u.id };
    }
    return {};
  }

  async resetPassword(identifier: string, code: string, newPassword: string): Promise<void> {
    const u = await this.authRepo.findByIdentifier(identifier.trim().toLowerCase());
    if (!u) throw new UnauthorizedError(ErrorMessages.OTP_INVALID, ErrorCodes.OTP_INVALID);
    await this.consumeOtp(u.id, 'PASSWORD_RESET', code);
    await this.authRepo.updatePasswordHash(u.id, await this.hashPassword(newPassword));
    await this.authRepo.revokeAllForUser(u.id);
  }

  /** Customer self-registration (mobile app). Creates user + customer + default address atomically. */
  async registerCustomer(input: RegisterCustomerInput, meta: RequestMeta) {
    if (await this.userRepo.findByMobile(input.mobile)) throw new ConflictError(ErrorMessages.MOBILE_IN_USE);
    if (input.email && (await this.userRepo.findByEmail(input.email))) throw new ConflictError(ErrorMessages.EMAIL_IN_USE);
    const area = input.address ? await this.customers.resolveServiceArea(input.address) : null;
    const passwordHash = await this.hashPassword(input.password);
    const created = await runInTransaction(async (tx) => {
      const [role] = await this.userRepo.findRolesByCodes([RoleCodes.CUSTOMER], tx);
      const user = await this.userRepo.create(
        { name: input.fullName, email: input.email ?? null, mobile: input.mobile, passwordHash, userType: 'CUSTOMER' },
        tx,
      );
      if (role) await this.userRepo.setRoles(user.id, [role.id], tx);
      const seq = await nextSequence(tx, 'CUSTOMER');
      const customer = await this.customerRepo.create(
        {
          customerCode: formatCode(NumberPrefixes.CUSTOMER, seq),
          userId: user.id,
          fullName: input.fullName,
          mobile: input.mobile,
          email: input.email ?? null,
          branchId: input.branchId ?? area?.branchId ?? null,
        },
        tx,
      );
      if (input.address) {
        await this.customerRepo.createAddress({ ...input.address, customerId: customer.id, isDefault: true, serviceAreaId: area?.id ?? null }, tx);
      }
      return user;
    });
    const u = await this.authRepo.findByIdWithAccess(created.id);
    return this.completeLogin(u as UserWithAccess, meta);
  }

  registerDevice(actor: AuthUser, token: string, platform: string) {
    return this.authRepo.upsertDeviceToken(actor.id, token, platform);
  }

  unregisterDevice(token: string) {
    return this.authRepo.deleteDeviceToken(token);
  }
}
