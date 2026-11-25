/**
 * Staff & technician management, plus roles/permissions administration.
 */

import { Prisma } from '@prisma/client';
import { ACTIVE_JOB_STATUSES, AuditActions, ErrorMessages, NumberPrefixes, RoleCodes } from '../constants';
import { StaffRepository } from '../repositories/staffRepository';
import { UserRepository } from '../repositories/userRepository';
import { nextSequence, runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { compact, formatCode, randomToken, toPageMeta, toPageParams } from '../utils/helpers';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { AuthService } from './authService';
import { SettingsService } from './settingsService';

export interface StaffInput {
  name: string;
  mobile: string;
  email?: string | null;
  username?: string | null;
  password?: string;
  roleCodes: string[];
  designation?: string | null;
  branchId: number;
  experienceYears: number;
  workStartTime: string;
  workEndTime: string;
  isTechnician: boolean;
  isAvailable: boolean;
  skillIds: number[];
  serviceAreaIds: number[];
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

const STAFF_ROLE_CODES: string[] = [RoleCodes.TECHNICIAN, RoleCodes.BRANCH_MANAGER, RoleCodes.COMPANY_ADMIN, RoleCodes.SUPER_ADMIN];

export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly users: UserRepository,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
  ) {}

  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; branchId?: number; isTechnician?: boolean; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; skillId?: number }) {
    const branchId = resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.StaffProfileWhereInput = {
      user: { deletedAt: null, ...(q.status ? { status: q.status } : {}) },
      ...(branchId ? { branchId } : {}),
      ...(q.isTechnician !== undefined ? { isTechnician: q.isTechnician } : {}),
      ...(q.skillId ? { skills: { some: { skillId: q.skillId } } } : {}),
      ...(q.search
        ? { OR: [{ staffCode: { contains: q.search } }, { user: { name: { contains: q.search } } }, { user: { mobile: { contains: q.search } } }, { user: { username: { contains: q.search.toLowerCase() } } }] }
        : {}),
    };
    const { items, total } = await this.repo.list(where, p.skip, p.take);
    const workload = await this.repo.workload(items.map((s) => s.id), ACTIVE_JOB_STATUSES);
    return { items: items.map((s) => ({ ...s, activeJobs: workload.get(s.id) ?? 0 })), meta: toPageMeta(p, total) };
  }

  async get(actor: AuthUser, id: number) {
    const s = await this.repo.findById(id);
    if (!s) throw new NotFoundError('Staff');
    assertBranchAccess(actor, s.branchId);
    return s;
  }

  private assertRoleGrant(actor: AuthUser, roleCodes: string[]) {
    if (roleCodes.some((r) => !STAFF_ROLE_CODES.includes(r) && r !== RoleCodes.CUSTOMER)) {
      // custom roles are allowed only for company-wide admins
      if (!actor.isCompanyWide) throw new ForbiddenError();
    }
    if (roleCodes.includes(RoleCodes.SUPER_ADMIN) && !actor.isSuperAdmin) throw new ForbiddenError();
    if (roleCodes.includes(RoleCodes.COMPANY_ADMIN) && !actor.isCompanyWide) throw new ForbiddenError();
  }

  async create(actor: AuthUser, input: StaffInput, meta: RequestMeta) {
    assertBranchAccess(actor, input.branchId);
    this.assertRoleGrant(actor, input.roleCodes);
    if (await this.users.findByMobile(input.mobile)) throw new ConflictError(ErrorMessages.MOBILE_IN_USE);
    if (input.email && (await this.users.findByEmail(input.email))) throw new ConflictError(ErrorMessages.EMAIL_IN_USE);
    if (input.username && (await this.users.findByUsername(input.username))) throw new ConflictError(ErrorMessages.USERNAME_IN_USE);
    const roles = await this.users.findRolesByCodes(input.roleCodes);
    if (roles.length !== input.roleCodes.length) throw new ValidationError('Unknown role selected');
    // If no password provided, set an unusable random one; staff then uses "Forgot password".
    const passwordHash = await this.auth.hashPassword(input.password ?? randomToken(24));
    const isAdmin = input.roleCodes.some((r) => r !== RoleCodes.TECHNICIAN);

    const staff = await runInTransaction(async (tx) => {
      const user = await this.users.create(
        { name: input.name, mobile: input.mobile, email: input.email ?? null, username: input.username ?? null, passwordHash, userType: isAdmin ? 'ADMIN' : 'STAFF', branchId: input.branchId },
        tx,
      );
      await this.users.setRoles(user.id, roles.map((r) => r.id), tx);
      const seq = await nextSequence(tx, 'STAFF');
      const profile = await this.repo.create(
        {
          userId: user.id,
          staffCode: formatCode(NumberPrefixes.STAFF, seq),
          designation: input.designation ?? null,
          branchId: input.branchId,
          experienceYears: input.experienceYears,
          workStartTime: input.workStartTime,
          workEndTime: input.workEndTime,
          isTechnician: input.isTechnician,
          isAvailable: input.isAvailable,
        },
        tx,
      );
      await this.repo.setSkills(profile.id, input.skillIds, tx);
      await this.repo.setServiceAreas(profile.id, input.serviceAreaIds, tx);
      return profile;
    });
    await this.settings.audit(actor, AuditActions.CREATE, 'staff', staff.id, null, { ...input, password: undefined }, meta);
    return this.repo.findById(staff.id);
  }

  async update(actor: AuthUser, id: number, input: Partial<StaffInput>, meta: RequestMeta) {
    const before = await this.get(actor, id);
    if (input.branchId) assertBranchAccess(actor, input.branchId);
    if (input.roleCodes) this.assertRoleGrant(actor, input.roleCodes);
    if (input.mobile && input.mobile !== before.user.mobile && (await this.users.findByMobile(input.mobile))) throw new ConflictError(ErrorMessages.MOBILE_IN_USE);
    if (input.email && input.email !== before.user.email && (await this.users.findByEmail(input.email))) throw new ConflictError(ErrorMessages.EMAIL_IN_USE);
    if (input.username && input.username !== before.user.username && (await this.users.findByUsername(input.username))) throw new ConflictError(ErrorMessages.USERNAME_IN_USE);
    const roles = input.roleCodes ? await this.users.findRolesByCodes(input.roleCodes) : null;
    const passwordHash = input.password ? await this.auth.hashPassword(input.password) : undefined;

    await runInTransaction(async (tx) => {
      await this.users.update(
        before.userId,
        compact({
          name: input.name,
          mobile: input.mobile,
          email: input.email,
          username: input.username,
          status: input.status,
          branchId: input.branchId,
          passwordHash,
          userType: input.roleCodes ? (input.roleCodes.some((r) => r !== RoleCodes.TECHNICIAN) ? 'ADMIN' : 'STAFF') : undefined,
        }) as Prisma.UserUncheckedUpdateInput,
        tx,
      );
      if (roles) await this.users.setRoles(before.userId, roles.map((r) => r.id), tx);
      await this.repo.update(
        id,
        compact({
          designation: input.designation,
          branchId: input.branchId,
          experienceYears: input.experienceYears,
          workStartTime: input.workStartTime,
          workEndTime: input.workEndTime,
          isTechnician: input.isTechnician,
          isAvailable: input.isAvailable,
        }) as Prisma.StaffProfileUncheckedUpdateInput,
        tx,
      );
      if (input.skillIds) await this.repo.setSkills(id, input.skillIds, tx);
      if (input.serviceAreaIds) await this.repo.setServiceAreas(id, input.serviceAreaIds, tx);
    });
    this.auth.invalidateCache(before.userId);
    await this.settings.audit(actor, AuditActions.UPDATE, 'staff', id, null, { ...input, password: undefined }, meta);
    return this.repo.findById(id);
  }

  async workHistory(actor: AuthUser, id: number, page?: number, pageSize?: number) {
    await this.get(actor, id);
    const p = toPageParams(page, pageSize);
    const { items, total } = await this.repo.workHistory(id, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  // ─── Roles & permissions ───
  listRoles() {
    return this.users.listRoles();
  }

  listPermissions() {
    return this.users.listPermissions();
  }

  async createRole(actor: AuthUser, input: { code: string; name: string; description?: string | null; permissionCodes: string[] }, meta: RequestMeta) {
    const perms = await this.users.findPermissionsByCodes(input.permissionCodes);
    const role = await runInTransaction(async (tx) => {
      const r = await this.users.createRole({ code: input.code, name: input.name, description: input.description ?? null }, tx).catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError(ErrorMessages.ALREADY_EXISTS('Role'));
        throw e;
      });
      await this.users.setRolePermissions(r.id, perms.map((p) => p.id), tx);
      return r;
    });
    await this.settings.audit(actor, AuditActions.CREATE, 'role', role.id, null, input, meta);
    return this.users.findRoleById(role.id);
  }

  async updateRole(actor: AuthUser, id: number, input: { name?: string; description?: string | null; permissionCodes?: string[] }, meta: RequestMeta) {
    const role = await this.users.findRoleById(id);
    if (!role) throw new NotFoundError('Role');
    if (role.code === RoleCodes.SUPER_ADMIN && input.permissionCodes) throw new ForbiddenError(ErrorMessages.SYSTEM_ROLE_LOCKED);
    await runInTransaction(async (tx) => {
      await this.users.updateRole(id, compact({ name: input.name, description: input.description }), tx);
      if (input.permissionCodes) {
        const perms = await this.users.findPermissionsByCodes(input.permissionCodes, tx);
        await this.users.setRolePermissions(id, perms.map((p) => p.id), tx);
      }
    });
    this.auth.invalidateCache();
    await this.settings.audit(actor, AuditActions.UPDATE, 'role', id, null, input, meta);
    return this.users.findRoleById(id);
  }

  async deleteRole(actor: AuthUser, id: number, meta: RequestMeta) {
    const role = await this.users.findRoleById(id);
    if (!role) throw new NotFoundError('Role');
    if (role.isSystem) throw new ForbiddenError(ErrorMessages.SYSTEM_ROLE_LOCKED);
    await this.users.deleteRole(id);
    this.auth.invalidateCache();
    await this.settings.audit(actor, AuditActions.DELETE, 'role', id, role, null, meta);
  }
}
