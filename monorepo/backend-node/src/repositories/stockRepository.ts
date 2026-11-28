/**
 * Stock item data access.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

const include = { branch: { select: { id: true, name: true } } } satisfies Prisma.StockItemInclude;

export class StockRepository {
  list(where: Prisma.StockItemWhereInput, db: Db = prisma) {
    return db.stockItem.findMany({ where, include, orderBy: { name: 'asc' } });
  }
  find(id: number, db: Db = prisma) {
    return db.stockItem.findUnique({ where: { id }, include });
  }
  create(data: Prisma.StockItemUncheckedCreateInput, db: Db = prisma) {
    return db.stockItem.create({ data, include });
  }
  update(id: number, data: Prisma.StockItemUncheckedUpdateInput, db: Db = prisma) {
    return db.stockItem.update({ where: { id }, data, include });
  }
  /** Atomic decrement of an active item of the branch; count is 0 when stock is insufficient. */
  consume(id: number, branchId: number, quantity: number, db: Db = prisma) {
    return db.stockItem.updateMany({ where: { id, branchId, isActive: true, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
  }
  /** Atomic quantity change that never goes below zero; count is 0 when it would. */
  adjust(id: number, change: number, db: Db = prisma) {
    return db.stockItem.updateMany({ where: { id, ...(change < 0 ? { quantity: { gte: -change } } : {}) }, data: { quantity: { increment: change } } });
  }
}
