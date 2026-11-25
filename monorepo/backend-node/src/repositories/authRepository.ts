/**
 * Auth data access: users (by login identifier), refresh tokens, OTP codes, device tokens.
 */

import { OtpPurpose, Prisma } from '@prisma/client';
import { Db, prisma } from './db';

const userAuthInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  customer: { select: { id: true } },
  staffProfile: { select: { id: true, branchId: true } },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userAuthInclude }>;

export class AuthRepository {
  findByIdentifier(identifier: string, db: Db = prisma): Promise<UserWithAccess | null> {
    return db.user.findFirst({
      where: { deletedAt: null, OR: [{ email: identifier }, { mobile: identifier }, { username: identifier }] },
      include: userAuthInclude,
    });
  }

  findByIdWithAccess(id: number, db: Db = prisma): Promise<UserWithAccess | null> {
    return db.user.findFirst({ where: { id, deletedAt: null }, include: userAuthInclude });
  }

  recordFailedLogin(userId: number, failedCount: number, lockedUntil: Date | null, db: Db = prisma) {
    return db.user.update({ where: { id: userId }, data: { failedLoginCount: failedCount, lockedUntil } });
  }

  recordSuccessfulLogin(userId: number, db: Db = prisma) {
    return db.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  updateAvatar(userId: number, avatarUrl: string | null, db: Db = prisma) {
    return db.user.update({ where: { id: userId }, data: { avatarUrl }, select: { avatarUrl: true } });
  }

  updatePasswordHash(userId: number, passwordHash: string, db: Db = prisma) {
    return db.user.update({ where: { id: userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
  }

  // ─── Refresh tokens ───
  createRefreshToken(data: Prisma.RefreshTokenUncheckedCreateInput, db: Db = prisma) {
    return db.refreshToken.create({ data });
  }

  findRefreshToken(tokenHash: string, db: Db = prisma) {
    return db.refreshToken.findUnique({ where: { tokenHash } });
  }

  markRefreshTokenReplaced(id: number, replacedBy: number, db: Db = prisma) {
    return db.refreshToken.update({ where: { id }, data: { revokedAt: new Date(), replacedBy } });
  }

  revokeRefreshToken(id: number, db: Db = prisma) {
    return db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  revokeFamily(familyId: string, db: Db = prisma) {
    return db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  revokeAllForUser(userId: number, db: Db = prisma) {
    return db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  listActiveSessions(userId: number, db: Db = prisma) {
    return db.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true, userAgent: true, ipAddress: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── OTP ───
  invalidateOtps(userId: number, purpose: OtpPurpose, db: Db = prisma) {
    return db.otpCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  }

  createOtp(data: Prisma.OtpCodeUncheckedCreateInput, db: Db = prisma) {
    return db.otpCode.create({ data });
  }

  findLatestOtp(userId: number, purpose: OtpPurpose, db: Db = prisma) {
    return db.otpCode.findFirst({
      where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  incrementOtpAttempts(id: number, db: Db = prisma) {
    return db.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  consumeOtp(id: number, db: Db = prisma) {
    return db.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  // ─── Devices ───
  upsertDeviceToken(userId: number, token: string, platform: string, db: Db = prisma) {
    return db.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  deleteDeviceToken(token: string, db: Db = prisma) {
    return db.deviceToken.deleteMany({ where: { token } });
  }
}
