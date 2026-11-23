/**
 * Customer ledger — append-only, transaction-safe running balances.
 * Balance > 0 means the customer owes the company.
 */

import { LedgerEntryType, Prisma } from '@prisma/client';
import { AuditActions, ReferenceTypes } from '../constants';
import { FinanceRepository } from '../repositories/financeRepository';
import { CustomerRepository } from '../repositories/customerRepository';
import { Db, runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { NotFoundError } from '../utils/errors';
import { moneyNumber, parseDateOnly, round2, toDecimal, toPageMeta, toPageParams } from '../utils/helpers';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { SettingsService } from './settingsService';

export interface LedgerPost {
  customerId: number;
  entryType: LedgerEntryType;
  referenceType?: string | null;
  referenceId?: number | null;
  referenceNumber?: string | null;
  description: string;
  debit?: number | Prisma.Decimal;
  credit?: number | Prisma.Decimal;
  createdById?: number | null;
}

export class LedgerService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly customers: CustomerRepository,
    private readonly settings: SettingsService,
  ) {}

  /** Appends an entry. MUST be called inside a transaction; locks the customer row to serialize postings. */
  async post(db: Db, entry: LedgerPost) {
    const tail = await this.repo.lockLedgerTail(entry.customerId, db);
    const debit = round2(entry.debit ?? 0);
    const credit = round2(entry.credit ?? 0);
    const balanceAfter = round2(toDecimal(tail?.balanceAfter ?? 0).plus(debit).minus(credit));
    return this.repo.appendLedger(
      {
        customerId: entry.customerId,
        entryType: entry.entryType,
        referenceType: entry.referenceType ?? null,
        referenceId: entry.referenceId ?? null,
        referenceNumber: entry.referenceNumber ?? null,
        description: entry.description,
        debit,
        credit,
        balanceAfter,
        createdById: entry.createdById ?? null,
      },
      db,
    );
  }

  async statement(actor: AuthUser, customerId: number, q: { page?: number; pageSize?: number; from?: string; to?: string }) {
    const customer = await this.customers.findById(customerId);
    if (!customer) throw new NotFoundError('Customer');
    if (actor.userType === 'CUSTOMER') {
      if (actor.customerId !== customerId) throw new NotFoundError('Customer');
    } else if (customer.branchId) assertBranchAccess(actor, customer.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.CustomerLedgerWhereInput = {
      customerId,
      ...(q.from || q.to ? { entryDate: { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) } } : {}),
    };
    const [{ items, total }, totals, latest] = await Promise.all([
      this.repo.listLedger(where, p.skip, p.take),
      this.repo.ledgerTotals(customerId),
      this.repo.latestLedgerEntry(customerId),
    ]);
    return {
      customer: { id: customer.id, fullName: customer.fullName, customerCode: customer.customerCode, mobile: customer.mobile },
      summary: {
        totalDebit: moneyNumber(totals._sum.debit),
        totalCredit: moneyNumber(totals._sum.credit),
        balance: moneyNumber(latest?.balanceAfter ?? 0),
      },
      items,
      meta: toPageMeta(p, total),
    };
  }

  async balance(customerId: number): Promise<number> {
    const latest = await this.repo.latestLedgerEntry(customerId);
    return moneyNumber(latest?.balanceAfter ?? 0);
  }

  async adjust(actor: AuthUser, input: { customerId: number; entryType: 'ADJUSTMENT' | 'OPENING_BALANCE'; direction: 'DEBIT' | 'CREDIT'; amount: number; description: string }, meta: RequestMeta) {
    const customer = await this.customers.findById(input.customerId);
    if (!customer) throw new NotFoundError('Customer');
    if (customer.branchId) assertBranchAccess(actor, customer.branchId);
    const entry = await runInTransaction((tx) =>
      this.post(tx, {
        customerId: input.customerId,
        entryType: input.entryType,
        referenceType: input.entryType === 'OPENING_BALANCE' ? ReferenceTypes.OPENING : ReferenceTypes.ADJUSTMENT,
        description: input.description,
        debit: input.direction === 'DEBIT' ? input.amount : 0,
        credit: input.direction === 'CREDIT' ? input.amount : 0,
        createdById: actor.id,
      }),
    );
    await this.settings.audit(actor, AuditActions.CREATE, 'ledger', entry.id, null, input, meta);
    return entry;
  }

  async outstanding(actor: AuthUser, q: { page?: number; pageSize?: number; branchId?: number }) {
    const branchId = resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const { items, total } = await this.repo.outstandingCustomers(branchId, p.skip, p.take);
    return {
      items: items.map((r) => ({ customerId: r.id, customerCode: r.customer_code, fullName: r.full_name, mobile: r.mobile, balance: moneyNumber(r.balance), lastEntry: r.last_entry })),
      meta: toPageMeta(p, total),
    };
  }
}
