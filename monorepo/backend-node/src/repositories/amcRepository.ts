/**
 * AMC contracts and visits data access.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export const amcInclude = {
  customer: { select: { id: true, fullName: true, mobile: true, countryCode: true, customerCode: true, email: true } },
  address: { include: { city: { select: { name: true } }, state: { select: { name: true } } } },
  branch: { select: { id: true, name: true } },
  services: { include: { service: { select: { id: true, name: true, code: true } } } },
  visits: {
    orderBy: { visitNumber: 'asc' },
    include: { booking: { select: { id: true, bookingNumber: true, status: true } } },
  },
  invoices: { select: { id: true, invoiceNumber: true, grandTotal: true, balanceDue: true, status: true } },
  payments: { select: { id: true, paymentNumber: true, amount: true, status: true, method: true } },
} satisfies Prisma.AmcContractInclude;

export type AmcDetail = Prisma.AmcContractGetPayload<{ include: typeof amcInclude }>;

export class AmcRepository {
  async list(where: Prisma.AmcContractWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.amcContract.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, mobile: true, customerCode: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { visits: true } },
          visits: { where: { status: 'COMPLETED' }, select: { id: true } },
        },
      }),
      db.amcContract.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: number, db: Db = prisma) {
    return db.amcContract.findUnique({ where: { id }, include: amcInclude });
  }

  async lockById(id: number, db: Db) {
    await db.$queryRaw`SELECT id FROM amc_contracts WHERE id = ${id} FOR UPDATE`;
    return db.amcContract.findUnique({ where: { id }, include: { services: true, visits: true } });
  }

  create(data: Prisma.AmcContractUncheckedCreateInput, serviceIds: number[], db: Db = prisma) {
    return db.amcContract.create({
      data: { ...data, services: { createMany: { data: serviceIds.map((serviceId) => ({ serviceId })) } } } as Prisma.AmcContractUncheckedCreateInput,
    });
  }

  update(id: number, data: Prisma.AmcContractUncheckedUpdateInput, db: Db = prisma) {
    return db.amcContract.update({ where: { id }, data });
  }

  async setServices(amcContractId: number, serviceIds: number[], db: Db = prisma) {
    await db.amcContractService.deleteMany({ where: { amcContractId } });
    if (serviceIds.length) await db.amcContractService.createMany({ data: serviceIds.map((serviceId) => ({ amcContractId, serviceId })) });
  }

  createVisits(data: Prisma.AmcVisitCreateManyInput[], db: Db = prisma) {
    return db.amcVisit.createMany({ data, skipDuplicates: true });
  }

  findVisit(id: number, db: Db = prisma) {
    return db.amcVisit.findUnique({ where: { id }, include: { amcContract: { include: { services: true } }, booking: true } });
  }

  updateVisit(id: number, data: Prisma.AmcVisitUncheckedUpdateInput, db: Db = prisma) {
    return db.amcVisit.update({ where: { id }, data });
  }

  async listVisits(where: Prisma.AmcVisitWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.amcVisit.findMany({
        where,
        skip,
        take,
        orderBy: { scheduledDate: 'asc' },
        include: {
          amcContract: {
            select: { id: true, amcNumber: true, branchId: true, customer: { select: { id: true, fullName: true, mobile: true } } },
          },
          booking: { select: { id: true, bookingNumber: true, status: true } },
        },
      }),
      db.amcVisit.count({ where }),
    ]);
    return { items, total };
  }

  markStatuses(where: Prisma.AmcContractWhereInput, status: Prisma.AmcContractUpdateInput['status'], db: Db = prisma) {
    return db.amcContract.updateMany({ where, data: { status } });
  }

  findExpiring(until: Date, db: Db = prisma) {
    return db.amcContract.findMany({
      where: { status: { in: ['ACTIVE', 'EXPIRING'] }, endDate: { lte: until } },
      include: { customer: { select: { id: true, userId: true, fullName: true } } },
    });
  }
}
