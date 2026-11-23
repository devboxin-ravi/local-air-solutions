/**
 * Staff / technician profiles data access.
 */

import { BookingStatus, Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export const staffInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      countryCode: true,
      status: true,
      lastLoginAt: true,
      roles: { include: { role: { select: { id: true, code: true, name: true } } } },
    },
  },
  branch: { select: { id: true, name: true } },
  skills: { include: { skill: { select: { id: true, name: true } } } },
  serviceAreas: { include: { serviceArea: { select: { id: true, name: true } } } },
} satisfies Prisma.StaffProfileInclude;

export type StaffWithRelations = Prisma.StaffProfileGetPayload<{ include: typeof staffInclude }>;

export class StaffRepository {
  async list(where: Prisma.StaffProfileWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.staffProfile.findMany({ where, skip, take, orderBy: { id: 'desc' }, include: staffInclude }),
      db.staffProfile.count({ where }),
    ]);
    return { items, total };
  }

  findAll(where: Prisma.StaffProfileWhereInput, db: Db = prisma) {
    return db.staffProfile.findMany({ where, include: staffInclude, orderBy: { id: 'asc' } });
  }

  findById(id: number, db: Db = prisma) {
    return db.staffProfile.findUnique({ where: { id }, include: staffInclude });
  }

  findByUserId(userId: number, db: Db = prisma) {
    return db.staffProfile.findUnique({ where: { userId }, include: staffInclude });
  }

  create(data: Prisma.StaffProfileUncheckedCreateInput, db: Db = prisma) {
    return db.staffProfile.create({ data });
  }

  update(id: number, data: Prisma.StaffProfileUncheckedUpdateInput, db: Db = prisma) {
    return db.staffProfile.update({ where: { id }, data });
  }

  async setSkills(staffId: number, skillIds: number[], db: Db = prisma) {
    await db.technicianSkill.deleteMany({ where: { staffId } });
    if (skillIds.length) await db.technicianSkill.createMany({ data: skillIds.map((skillId) => ({ staffId, skillId })) });
  }

  async setServiceAreas(staffId: number, areaIds: number[], db: Db = prisma) {
    await db.staffServiceArea.deleteMany({ where: { staffId } });
    if (areaIds.length) await db.staffServiceArea.createMany({ data: areaIds.map((serviceAreaId) => ({ staffId, serviceAreaId })) });
  }

  /** Count of current assignments per staff in given booking statuses (workload). */
  async workload(staffIds: number[], statuses: BookingStatus[], date?: Date, db: Db = prisma) {
    if (!staffIds.length) return new Map<number, number>();
    const rows = await db.technicianAssignment.groupBy({
      by: ['staffId'],
      where: {
        staffId: { in: staffIds },
        isCurrent: true,
        booking: { status: { in: statuses }, ...(date ? { scheduledDate: date } : {}) },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.staffId, r._count._all]));
  }

  async workHistory(staffId: number, skip: number, take: number, db: Db = prisma) {
    const where: Prisma.TechnicianAssignmentWhereInput = { staffId };
    const [items, total] = await Promise.all([
      db.technicianAssignment.findMany({
        where,
        skip,
        take,
        orderBy: { assignedAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              status: true,
              scheduledDate: true,
              customer: { select: { fullName: true } },
              items: { select: { serviceName: true } },
            },
          },
        },
      }),
      db.technicianAssignment.count({ where }),
    ]);
    return { items, total };
  }
}
