/**
 * Customers and customer addresses data access.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export const addressInclude = {
  state: { select: { id: true, name: true } },
  city: { select: { id: true, name: true } },
  serviceArea: { select: { id: true, name: true, branchId: true } },
} satisfies Prisma.CustomerAddressInclude;

export class CustomerRepository {
  async list(where: Prisma.CustomerWhereInput, orderBy: Prisma.CustomerOrderByWithRelationInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          branch: { select: { id: true, name: true } },
          addresses: { where: { isDefault: true, isActive: true }, include: addressInclude, take: 1 },
          _count: { select: { bookings: true, amcContracts: true } },
        },
      }),
      db.customer.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: number, db: Db = prisma) {
    return db.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        addresses: { where: { isActive: true }, include: addressInclude, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] },
        user: { select: { id: true, status: true, lastLoginAt: true } },
      },
    });
  }

  findByUserId(userId: number, db: Db = prisma) {
    return db.customer.findFirst({ where: { userId, deletedAt: null } });
  }

  findByMobile(mobile: string, db: Db = prisma) {
    return db.customer.findMany({ where: { mobile, deletedAt: null }, select: { id: true, fullName: true, customerCode: true } });
  }

  create(data: Prisma.CustomerUncheckedCreateInput, db: Db = prisma) {
    return db.customer.create({ data });
  }

  update(id: number, data: Prisma.CustomerUncheckedUpdateInput, db: Db = prisma) {
    return db.customer.update({ where: { id }, data });
  }

  // ─── Addresses ───
  listAddresses(customerId: number, db: Db = prisma) {
    return db.customerAddress.findMany({
      where: { customerId, isActive: true },
      include: addressInclude,
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
  }

  async listAllAddresses(where: Prisma.CustomerAddressWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.customerAddress.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: { ...addressInclude, customer: { select: { id: true, fullName: true, customerCode: true, mobile: true } } },
      }),
      db.customerAddress.count({ where }),
    ]);
    return { items, total };
  }

  findAddress(id: number, db: Db = prisma) {
    return db.customerAddress.findUnique({ where: { id }, include: addressInclude });
  }

  createAddress(data: Prisma.CustomerAddressUncheckedCreateInput, db: Db = prisma) {
    return db.customerAddress.create({ data, include: addressInclude });
  }

  updateAddress(id: number, data: Prisma.CustomerAddressUncheckedUpdateInput, db: Db = prisma) {
    return db.customerAddress.update({ where: { id }, data, include: addressInclude });
  }

  clearDefaultAddress(customerId: number, db: Db = prisma) {
    return db.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
  }

  countAddresses(customerId: number, db: Db = prisma) {
    return db.customerAddress.count({ where: { customerId, isActive: true } });
  }
}
