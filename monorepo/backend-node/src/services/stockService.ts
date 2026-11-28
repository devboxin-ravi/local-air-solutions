/**
 * Branch-wise stock: item maintenance, manual adjustments and invoice consumption/restore.
 */

import { Prisma } from '@prisma/client';
import { AuditActions, ErrorMessages } from '../constants';
import { StockRepository } from '../repositories/stockRepository';
import type { Db } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { BusinessRuleError, ConflictError, NotFoundError } from '../utils/errors';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { SettingsService } from './settingsService';

const LABEL = 'Stock item';
const AUDIT_ENTITY = 'stockItem';

export interface StockListFilter {
  branchId?: number;
  activeOnly?: boolean;
  search?: string;
}

/** One billed stock line of an invoice. */
export interface StockLine {
  stockItemId?: number | null;
  quantity: number;
}

const mapDbError = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError(ErrorMessages.ALREADY_EXISTS(`${LABEL} with this code`));
  throw err;
};

/** Total quantity per stock item, in id order so concurrent invoices lock rows consistently. */
const totals = (lines: StockLine[]): Array<[number, number]> => {
  const map = new Map<number, number>();
  for (const l of lines) if (l.stockItemId) map.set(l.stockItemId, (map.get(l.stockItemId) ?? 0) + l.quantity);
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
};

export class StockService {
  constructor(
    private readonly repo: StockRepository,
    private readonly settings: SettingsService,
  ) {}

  list(actor: AuthUser, f: StockListFilter) {
    const branchId = resolveBranchScope(actor, f.branchId);
    return this.repo.list({
      ...(branchId ? { branchId } : {}),
      ...(f.activeOnly ? { isActive: true } : {}),
      ...(f.search ? { OR: [{ name: { contains: f.search } }, { code: { contains: f.search } }] } : {}),
    });
  }

  private async getOwned(actor: AuthUser, id: number) {
    const item = await this.repo.find(id);
    if (!item) throw new NotFoundError(LABEL);
    assertBranchAccess(actor, item.branchId);
    return item;
  }

  async create(actor: AuthUser, data: Prisma.StockItemUncheckedCreateInput, meta: RequestMeta) {
    assertBranchAccess(actor, data.branchId);
    const created = await this.repo.create(data).catch(mapDbError);
    await this.settings.audit(actor, AuditActions.CREATE, AUDIT_ENTITY, created.id, null, created, meta);
    return created;
  }

  async update(actor: AuthUser, id: number, data: Prisma.StockItemUncheckedUpdateInput, meta: RequestMeta) {
    await this.getOwned(actor, id);
    const updated = await this.repo.update(id, data).catch(mapDbError);
    await this.settings.audit(actor, AuditActions.UPDATE, AUDIT_ENTITY, id, null, data, meta);
    return updated;
  }

  /** Soft delete: invoices keep referring to the item. */
  async remove(actor: AuthUser, id: number, meta: RequestMeta) {
    await this.update(actor, id, { isActive: false }, meta);
  }

  /** Stock received (positive change) or written off (negative change). */
  async adjust(actor: AuthUser, id: number, input: { change: number; note?: string | null }, meta: RequestMeta) {
    const item = await this.getOwned(actor, id);
    const { count } = await this.repo.adjust(id, input.change);
    if (!count) throw new BusinessRuleError(ErrorMessages.STOCK_UNAVAILABLE(item.name, item.quantity));
    const updated = await this.getOwned(actor, id);
    await this.settings.audit(actor, AuditActions.UPDATE, AUDIT_ENTITY, id, { quantity: item.quantity }, { quantity: updated.quantity, change: input.change, note: input.note ?? null }, meta);
    return updated;
  }

  /** Deducts billed quantities inside the invoice transaction; fails the invoice if stock is short. */
  async consume(tx: Db, branchId: number, lines: StockLine[]) {
    for (const [id, quantity] of totals(lines)) {
      const { count } = await this.repo.consume(id, branchId, quantity, tx);
      if (count) continue;
      const item = await this.repo.find(id, tx);
      if (!item || item.branchId !== branchId || !item.isActive) throw new BusinessRuleError(ErrorMessages.STOCK_ITEM_INVALID);
      throw new BusinessRuleError(ErrorMessages.STOCK_UNAVAILABLE(item.name, item.quantity));
    }
  }

  /** HSN codes of the billed stock items, for the invoice lines. */
  async hsnCodes(tx: Db, lines: StockLine[]) {
    const ids = totals(lines).map(([id]) => id);
    const items = ids.length ? await this.repo.list({ id: { in: ids } }, tx) : [];
    return new Map(items.map((i) => [i.id, i.hsnCode]));
  }

  /** Returns billed quantities to stock when an invoice is cancelled. */
  async restore(tx: Db, lines: StockLine[]) {
    for (const [id, quantity] of totals(lines)) await this.repo.adjust(id, quantity, tx);
  }
}
