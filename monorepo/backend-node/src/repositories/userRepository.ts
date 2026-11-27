/**
 * Users, roles and permissions data access.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export class UserRepository {
  findById(id: number, db: Db = prisma) {
    return db.user.findFirst({ where: { id, deletedAt: null }, include: { roles: { include: { role: true } } } });
  }

  findByMobile(mobile: string, db: Db = prisma) {
    return db.user.findUnique({ where: { mobile } });
  }

  findByEmail(email: string, db: Db = prisma) {
    return db.user.findUnique({ where: { email } });
  }

  findByUsername(username: string, db: Db = prisma) {
    return db.user.findUnique({ where: { username } });
  }

  create(data: Prisma.UserUncheckedCreateInput, db: Db = prisma) {
    return db.user.create({ data });
  }

  update(id: number, data: Prisma.UserUncheckedUpdateInput, db: Db = prisma) {
    return db.user.update({ where: { id }, data });
  }

  async setRoles(userId: number, roleIds: number[], db: Db = prisma) {
    await db.userRole.deleteMany({ where: { userId } });
    if (roleIds.length) await db.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) });
  }

  // ─── Roles ───
  listRoles(db: Db = prisma) {
    return db.role.findMany({
      orderBy: { id: 'asc' },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
  }

  findRoleById(id: number, db: Db = prisma) {
    return db.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
  }

  findRolesByCodes(codes: string[], db: Db = prisma) {
    return db.role.findMany({ where: { code: { in: codes } } });
  }

  createRole(data: Prisma.RoleCreateInput, db: Db = prisma) {
    return db.role.create({ data });
  }

  updateRole(id: number, data: Prisma.RoleUpdateInput, db: Db = prisma) {
    return db.role.update({ where: { id }, data });
  }

  /** Active (not deleted) users holding a role. */
  countRoleUsers(roleId: number, db: Db = prisma) {
    return db.userRole.count({ where: { roleId, user: { deletedAt: null } } });
  }

  deleteRole(id: number, db: Db = prisma) {
    return db.role.delete({ where: { id } });
  }

  async setRolePermissions(roleId: number, permissionIds: number[], db: Db = prisma) {
    await db.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length) {
      await db.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) });
    }
  }

  listPermissions(db: Db = prisma) {
    return db.permission.findMany({ orderBy: [{ module: 'asc' }, { id: 'asc' }] });
  }

  findPermissionsByCodes(codes: string[], db: Db = prisma) {
    return db.permission.findMany({ where: { code: { in: codes } } });
  }

  /** Users that hold any of the given role codes, optionally limited to a branch. */
  findUsersByRoles(codes: string[], branchId?: number | null, db: Db = prisma) {
    return db.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        roles: { some: { role: { code: { in: codes } } } },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      select: { id: true, name: true, email: true },
    });
  }
}
