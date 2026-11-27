/**
 * Finance data access: invoices, payments, gateway transactions, customer ledger.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export const invoiceInclude = {
  customer: { select: { id: true, fullName: true, mobile: true, countryCode: true, email: true, customerCode: true } },
  branch: { select: { id: true, name: true } },
  booking: { select: { id: true, bookingNumber: true } },
  amcContract: { select: { id: true, amcNumber: true } },
  items: true,
  payments: { orderBy: { createdAt: 'desc' }, select: { id: true, paymentNumber: true, amount: true, method: true, status: true, referenceNumber: true, receivedAt: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDetail = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export const paymentInclude = {
  customer: { select: { id: true, fullName: true, mobile: true, customerCode: true } },
  invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, balanceDue: true } },
  booking: { select: { id: true, bookingNumber: true } },
  amcContract: { select: { id: true, amcNumber: true } },
} satisfies Prisma.PaymentInclude;

export class FinanceRepository {
  // ─── Invoices ───
  async listInvoices(where: Prisma.InvoiceWhereInput, orderBy: Prisma.InvoiceOrderByWithRelationInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          customer: { select: { id: true, fullName: true, mobile: true, customerCode: true } },
          branch: { select: { id: true, name: true } },
          booking: { select: { id: true, bookingNumber: true } },
        },
      }),
      db.invoice.count({ where }),
    ]);
    return { items, total };
  }

  findInvoice(id: number, db: Db = prisma) {
    return db.invoice.findUnique({ where: { id }, include: invoiceInclude });
  }

  findInvoicesByIds(ids: number[], db: Db = prisma) {
    return db.invoice.findMany({ where: { id: { in: ids } }, include: invoiceInclude });
  }

  async lockInvoice(id: number, db: Db) {
    await db.$queryRaw`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;
    return db.invoice.findUnique({ where: { id } });
  }

  findActiveInvoiceForBooking(bookingId: number, db: Db = prisma) {
    return db.invoice.findFirst({ where: { bookingId, status: { not: 'CANCELLED' } } });
  }

  findActiveInvoiceForAmc(amcContractId: number, db: Db = prisma) {
    return db.invoice.findFirst({ where: { amcContractId, status: { not: 'CANCELLED' } } });
  }

  createInvoice(data: Prisma.InvoiceUncheckedCreateInput, items: Omit<Prisma.InvoiceItemCreateManyInput, 'invoiceId'>[], db: Db = prisma) {
    return db.invoice.create({ data: { ...data, items: { createMany: { data: items } } } as Prisma.InvoiceUncheckedCreateInput });
  }

  updateInvoice(id: number, data: Prisma.InvoiceUncheckedUpdateInput, db: Db = prisma) {
    return db.invoice.update({ where: { id }, data });
  }

  // ─── Payments ───
  async listPayments(where: Prisma.PaymentWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.payment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: paymentInclude }),
      db.payment.count({ where }),
    ]);
    return { items, total };
  }

  findPayment(id: number, db: Db = prisma) {
    return db.payment.findUnique({ where: { id }, include: paymentInclude });
  }

  async lockPayment(id: number, db: Db) {
    await db.$queryRaw`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`;
    return db.payment.findUnique({ where: { id } });
  }

  findPaymentByIdempotencyKey(key: string, db: Db = prisma) {
    return db.payment.findUnique({ where: { idempotencyKey: key }, include: paymentInclude });
  }

  findPaymentByReference(method: Prisma.PaymentWhereInput['method'], referenceNumber: string, db: Db = prisma) {
    return db.payment.findFirst({ where: { method, referenceNumber } });
  }

  createPayment(data: Prisma.PaymentUncheckedCreateInput, db: Db = prisma) {
    return db.payment.create({ data, include: paymentInclude });
  }

  updatePayment(id: number, data: Prisma.PaymentUncheckedUpdateInput, db: Db = prisma) {
    return db.payment.update({ where: { id }, data, include: paymentInclude });
  }

  // ─── Gateway transactions ───
  createGatewayTxn(data: Prisma.PaymentGatewayTransactionUncheckedCreateInput, db: Db = prisma) {
    return db.paymentGatewayTransaction.create({ data });
  }

  findGatewayTxnByOrder(orderId: string, db: Db = prisma) {
    return db.paymentGatewayTransaction.findUnique({ where: { orderId } });
  }

  async lockGatewayTxnByOrder(orderId: string, db: Db) {
    await db.$queryRaw`SELECT id FROM payment_gateway_transactions WHERE order_id = ${orderId} FOR UPDATE`;
    return db.paymentGatewayTransaction.findUnique({ where: { orderId } });
  }

  updateGatewayTxn(id: number, data: Prisma.PaymentGatewayTransactionUncheckedUpdateInput, db: Db = prisma) {
    return db.paymentGatewayTransaction.update({ where: { id }, data });
  }

  // ─── Ledger (append-only) ───
  /** Locks the customer's ledger tail so running balances stay consistent under concurrency. */
  async lockLedgerTail(customerId: number, db: Db) {
    await db.$queryRaw`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`;
    return db.customerLedger.findFirst({ where: { customerId }, orderBy: { id: 'desc' } });
  }

  appendLedger(data: Prisma.CustomerLedgerUncheckedCreateInput, db: Db = prisma) {
    return db.customerLedger.create({ data });
  }

  async listLedger(where: Prisma.CustomerLedgerWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.customerLedger.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      db.customerLedger.count({ where }),
    ]);
    return { items, total };
  }

  latestLedgerEntry(customerId: number, db: Db = prisma) {
    return db.customerLedger.findFirst({ where: { customerId }, orderBy: { id: 'desc' } });
  }

  ledgerTotals(customerId: number, db: Db = prisma) {
    return db.customerLedger.aggregate({ where: { customerId }, _sum: { debit: true, credit: true } });
  }

  /** Customers with outstanding balance (latest balance > 0). */
  async outstandingCustomers(branchId: number | undefined, skip: number, take: number, db: Db = prisma) {
    const branchFilter = branchId ? Prisma.sql`AND c.branch_id = ${branchId}` : Prisma.empty;
    const rows = await db.$queryRaw<Array<{ id: number; customer_code: string; full_name: string; mobile: string; balance: Prisma.Decimal; last_entry: Date }>>`
      SELECT c.id, c.customer_code, c.full_name, c.mobile, l.balance_after AS balance, l.entry_date AS last_entry
        FROM customers c
        JOIN customer_ledger l ON l.id = (SELECT MAX(id) FROM customer_ledger WHERE customer_id = c.id)
       WHERE l.balance_after > 0 ${branchFilter}
       ORDER BY l.balance_after DESC
       LIMIT ${take} OFFSET ${skip}`;
    const count = await db.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total
        FROM customers c
        JOIN customer_ledger l ON l.id = (SELECT MAX(id) FROM customer_ledger WHERE customer_id = c.id)
       WHERE l.balance_after > 0 ${branchFilter}`;
    return { items: rows, total: Number(count[0]?.total ?? 0) };
  }

  /**
   * Every (non-deleted) customer with their ledger position: current balance (latest balance_after,
   * 0 when no entries), total debit / credit and last entry date. Branch filter also includes customers
   * not yet assigned to a branch. Sorted by balance (highest first), then name.
   */
  async customerBalances(q: { branchId?: number; search?: string }, skip: number, take: number, db: Db = prisma) {
    const branchFilter = q.branchId ? Prisma.sql`AND (c.branch_id = ${q.branchId} OR c.branch_id IS NULL)` : Prisma.empty;
    const like = q.search ? `%${q.search}%` : null;
    const searchFilter = like
      ? Prisma.sql`AND (c.full_name LIKE ${like} OR c.mobile LIKE ${like} OR c.customer_code LIKE ${like} OR c.email LIKE ${like})`
      : Prisma.empty;
    const rows = await db.$queryRaw<
      Array<{ id: number; customer_code: string; full_name: string; mobile: string; branch_name: string | null; balance: Prisma.Decimal | null; total_debit: Prisma.Decimal | null; total_credit: Prisma.Decimal | null; last_entry: Date | null }>
    >`
      SELECT c.id, c.customer_code, c.full_name, c.mobile, b.name AS branch_name,
             latest.balance_after AS balance, t.total_debit, t.total_credit, latest.entry_date AS last_entry
        FROM customers c
        LEFT JOIN branches b ON b.id = c.branch_id
        LEFT JOIN customer_ledger latest ON latest.id = (SELECT MAX(id) FROM customer_ledger WHERE customer_id = c.id)
        LEFT JOIN (SELECT customer_id, SUM(debit) AS total_debit, SUM(credit) AS total_credit FROM customer_ledger GROUP BY customer_id) t ON t.customer_id = c.id
       WHERE c.deleted_at IS NULL ${branchFilter} ${searchFilter}
       ORDER BY COALESCE(latest.balance_after, 0) DESC, c.full_name ASC, c.id ASC
       LIMIT ${take} OFFSET ${skip}`;
    const count = await db.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total FROM customers c WHERE c.deleted_at IS NULL ${branchFilter} ${searchFilter}`;
    return { items: rows, total: Number(count[0]?.total ?? 0) };
  }

  /** Verified payments not yet attached to an invoice (prepaid against a booking/AMC). */
  findUnappliedVerifiedPayments(where: { bookingId?: number | null; amcContractId?: number | null }, db: Db = prisma) {
    if (!where.bookingId && !where.amcContractId) return Promise.resolve([]);
    return db.payment.findMany({
      where: { status: 'VERIFIED', invoiceId: null, ...(where.bookingId ? { bookingId: where.bookingId } : { amcContractId: where.amcContractId as number }) },
    });
  }

  attachPaymentsToInvoice(paymentIds: number[], invoiceId: number, db: Db = prisma) {
    return db.payment.updateMany({ where: { id: { in: paymentIds } }, data: { invoiceId } });
  }

  sumVerifiedForBooking(bookingId: number, db: Db = prisma) {
    return db.payment.aggregate({ where: { bookingId, status: 'VERIFIED' }, _sum: { amount: true } });
  }

  setBookingPaymentStatus(bookingId: number, paymentStatus: 'UNPAID' | 'PENDING_VERIFICATION' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED', db: Db = prisma) {
    return db.serviceBooking.update({ where: { id: bookingId }, data: { paymentStatus } });
  }

  async lockBooking(bookingId: number, db: Db) {
    await db.$queryRaw`SELECT id FROM service_bookings WHERE id = ${bookingId} FOR UPDATE`;
  }

  findGatewayTxnByPayment(paymentId: number, db: Db = prisma) {
    return db.paymentGatewayTransaction.findFirst({ where: { paymentId } });
  }
}
