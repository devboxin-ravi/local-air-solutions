/**
 * Invoices: GST-aware calculation, generation from bookings/AMC/manual lines,
 * free-service records, cancellation via ledger reversal, and immutable snapshots.
 */

import { Prisma } from '@prisma/client';
import { AuditActions, ErrorMessages, NotificationEvents, NumberPrefixes, ReferenceTypes } from '../constants';
import { FinanceRepository } from '../repositories/financeRepository';
import { BookingRepository } from '../repositories/bookingRepository';
import { CustomerRepository } from '../repositories/customerRepository';
import { MasterDataRepository } from '../repositories/masterDataRepository';
import { Db, nextSequence, runInTransaction } from '../repositories/db';
import type { AuthUser, InvoiceLineInput, InvoiceTotals, RequestMeta } from '../models';
import { BusinessRuleError, ConflictError, NotFoundError } from '../utils/errors';
import { formatDocNumber, formatInr, moneyNumber, parseDateOnly, round2, toPageMeta, toPageParams } from '../utils/helpers';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { LedgerService } from './ledgerService';
import { NotificationService } from './notificationService';
import { SettingsService } from './settingsService';

export interface InvoiceOptions {
  applyGst: boolean;
  isInterState: boolean;
  discount: number;
  isFreeService: boolean;
  notes?: string | null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Pure GST calculation. Invoice-level discount is allocated proportionally across lines
 * before tax so the GST base is correct. Free service = 100% discount, original value retained.
 */
export function calculateInvoice(lines: InvoiceLineInput[], opts: { applyGst: boolean; isInterState: boolean; discount: number; isFreeService: boolean }): InvoiceTotals {
  const base = lines.map((l) => {
    const gross = r2(l.quantity * l.rate);
    const lineDiscount = r2(Math.min(l.discount ?? 0, gross));
    return { ...l, gross, lineDiscount, net: r2(gross - lineDiscount), gstRate: opts.applyGst ? l.gstRate ?? 0 : 0 };
  });
  const subtotal = r2(base.reduce((s, l) => s + l.gross, 0));
  const lineDiscounts = r2(base.reduce((s, l) => s + l.lineDiscount, 0));
  const netBeforeInvoiceDiscount = r2(subtotal - lineDiscounts);
  const invoiceDiscount = opts.isFreeService ? netBeforeInvoiceDiscount : r2(Math.min(opts.discount, netBeforeInvoiceDiscount));

  let allocated = 0;
  let gstTotal = 0;
  const out = base.map((l, idx) => {
    const share = netBeforeInvoiceDiscount > 0 ? (idx === base.length - 1 ? r2(invoiceDiscount - allocated) : r2((l.net / netBeforeInvoiceDiscount) * invoiceDiscount)) : 0;
    allocated = r2(allocated + share);
    const taxable = r2(l.net - share);
    gstTotal = r2(gstTotal + r2((taxable * l.gstRate) / 100));
    return { serviceId: l.serviceId, description: l.description, quantity: l.quantity, rate: l.rate, discount: r2(l.lineDiscount + share), gstRate: l.gstRate, amount: l.gross };
  });

  const discount = r2(lineDiscounts + invoiceDiscount);
  const taxableAmount = r2(subtotal - discount);
  const cgst = opts.isInterState ? 0 : r2(gstTotal / 2);
  const sgst = opts.isInterState ? 0 : r2(gstTotal - cgst);
  const igst = opts.isInterState ? gstTotal : 0;
  return { lines: out, subtotal, discount, taxableAmount, cgst, sgst, igst, gstTotal, grandTotal: r2(taxableAmount + gstTotal) };
}

export class InvoiceService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly bookings: BookingRepository,
    private readonly customers: CustomerRepository,
    private readonly master: MasterDataRepository,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
  ) {}

  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; sortOrder?: 'asc' | 'desc'; branchId?: number; status?: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'; customerId?: number; from?: string; to?: string; isFreeService?: boolean; outstandingOnly?: boolean }) {
    const isCustomer = actor.userType === 'CUSTOMER';
    const branchId = isCustomer ? undefined : resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.InvoiceWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(isCustomer ? { customerId: actor.customerId ?? -1, status: { not: 'DRAFT' } } : q.customerId ? { customerId: q.customerId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.isFreeService !== undefined ? { isFreeService: q.isFreeService } : {}),
      ...(q.outstandingOnly ? { balanceDue: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } } : {}),
      ...(q.from || q.to ? { invoiceDate: { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) } } : {}),
      ...(q.search ? { OR: [{ invoiceNumber: { contains: q.search } }, { customer: { fullName: { contains: q.search } } }, { customer: { mobile: { contains: q.search } } }] } : {}),
    };
    const { items, total } = await this.repo.listInvoices(where, { invoiceDate: q.sortOrder ?? 'desc' }, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async get(actor: AuthUser, id: number) {
    const inv = await this.repo.findInvoice(id);
    if (!inv) throw new NotFoundError('Invoice');
    if (actor.userType === 'CUSTOMER') {
      if (inv.customerId !== actor.customerId) throw new NotFoundError('Invoice');
    } else assertBranchAccess(actor, inv.branchId);
    return this.withCompanyProfile(inv);
  }

  /** Invoice for a signed public PDF link (no login): never a cancelled one. */
  async getForShareLink(id: number) {
    const inv = await this.repo.findInvoice(id);
    if (!inv || inv.status === 'CANCELLED') throw new NotFoundError('Invoice');
    return this.withCompanyProfile(inv);
  }

  /**
   * Company details on an invoice come from Settings → Company Profile (copied when the invoice is issued).
   * Fields that were still blank at issue time (profile completed later) are filled from the current
   * profile; values already on the invoice are kept exactly as issued.
   */
  private async withCompanyProfile<T extends { snapshot: Prisma.JsonValue }>(inv: T): Promise<T> {
    const current = (await this.settings.company()) as unknown as Record<string, unknown>;
    const snap = (inv.snapshot && typeof inv.snapshot === 'object' && !Array.isArray(inv.snapshot) ? inv.snapshot : {}) as Record<string, unknown>;
    const issued = (snap.company && typeof snap.company === 'object' ? snap.company : {}) as Record<string, unknown>;
    const company: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(issued)) if (value !== null && value !== undefined && value !== '') company[key] = value;
    return { ...inv, snapshot: { ...snap, company } as Prisma.JsonObject };
  }

  preview(lines: InvoiceLineInput[], opts: InvoiceOptions) {
    return calculateInvoice(lines, opts);
  }

  private async buildSnapshot(customerId: number, branchId: number, extra: Record<string, unknown>, db?: Db) {
    const [company, customer, branch] = await Promise.all([this.settings.company(db), this.customers.findById(customerId, db), this.master.findBranch(branchId, db)]);
    const addr = customer?.addresses.find((a) => a.isDefault) ?? customer?.addresses[0];
    return {
      company,
      branch: branch ? { name: branch.name, address: branch.address, phone: branch.phone, email: branch.email, gstin: branch.gstin } : null,
      customer: {
        name: customer?.fullName,
        code: customer?.customerCode,
        mobile: customer ? `${customer.countryCode} ${customer.mobile}` : '',
        email: customer?.email,
        address: addr ? [addr.line1, addr.line2, addr.landmark, addr.city.name, addr.state.name, addr.pincode].filter(Boolean).join(', ') : '',
      },
      ...extra,
    };
  }

  /** Creates the invoice + items + ledger debit inside the given transaction. */
  async createInTx(
    tx: Db,
    actor: AuthUser,
    args: { customerId: number; branchId: number; bookingId?: number | null; amcContractId?: number | null; lines: InvoiceLineInput[]; opts: InvoiceOptions; snapshotExtra?: Record<string, unknown> },
  ) {
    const gst = await this.settings.gst(tx);
    const totals = calculateInvoice(args.lines, { ...args.opts, applyGst: args.opts.applyGst && gst.enabled });
    const year = new Date().getFullYear();
    const seq = await nextSequence(tx, `INVOICE-${year}`);
    const invoiceNumber = formatDocNumber(NumberPrefixes.INVOICE, year, seq);
    const snapshot = await this.buildSnapshot(args.customerId, args.branchId, { sacCode: gst.sacCode, ...(args.snapshotExtra ?? {}) }, tx);

    // Prepaid payments already verified against the booking/AMC are applied to this invoice.
    const prepaid = await this.repo.findUnappliedVerifiedPayments({ bookingId: args.bookingId, amcContractId: args.amcContractId }, tx);
    const prepaidSum = moneyNumber(prepaid.reduce((s, p) => s + Number(p.amount), 0));
    const amountPaid = Math.min(prepaidSum, totals.grandTotal);
    const balanceDue = r2(totals.grandTotal - amountPaid);

    const invoice = await this.repo.createInvoice(
      {
        invoiceNumber,
        customerId: args.customerId,
        branchId: args.branchId,
        bookingId: args.bookingId ?? null,
        amcContractId: args.amcContractId ?? null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxableAmount: totals.taxableAmount,
        applyGst: args.opts.applyGst && gst.enabled,
        isInterState: args.opts.isInterState,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        gstTotal: totals.gstTotal,
        grandTotal: totals.grandTotal,
        amountPaid,
        balanceDue,
        status: balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED',
        isFreeService: args.opts.isFreeService,
        snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
        notes: args.opts.notes ?? null,
        createdById: actor.id,
      },
      totals.lines.map((l) => ({ serviceId: l.serviceId ?? null, description: l.description, hsnSac: gst.sacCode, quantity: l.quantity, rate: round2(l.rate), discount: round2(l.discount), gstRate: round2(l.gstRate), amount: round2(l.amount) })),
      tx,
    );
    if (prepaid.length) await this.repo.attachPaymentsToInvoice(prepaid.map((p) => p.id), invoice.id, tx);

    await this.ledger.post(tx, {
      customerId: args.customerId,
      entryType: 'INVOICE',
      referenceType: ReferenceTypes.INVOICE,
      referenceId: invoice.id,
      referenceNumber: invoiceNumber,
      description: args.opts.isFreeService ? `Free service invoice (value ₹${formatInr(totals.subtotal)})` : `Invoice ${invoiceNumber}`,
      debit: totals.grandTotal,
      createdById: actor.id,
    });
    if (args.bookingId) {
      await this.repo.setBookingPaymentStatus(args.bookingId, balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID', tx);
    }
    return invoice;
  }

  async createFromBooking(actor: AuthUser, input: { bookingId: number; applyGst: boolean; isInterState: boolean; discount: number; isFreeService: boolean; lines?: InvoiceLineInput[]; notes?: string | null }, meta: RequestMeta) {
    const booking = await this.bookings.findById(input.bookingId);
    if (!booking) throw new NotFoundError('Booking');
    assertBranchAccess(actor, booking.branchId);
    if (booking.status !== 'COMPLETED') throw new BusinessRuleError(ErrorMessages.BOOKING_NOT_COMPLETED);

    const lines: InvoiceLineInput[] =
      input.lines ??
      booking.items.map((i) => ({ serviceId: i.serviceId, description: i.serviceName, quantity: i.quantity, rate: moneyNumber(i.unitPrice), discount: 0, gstRate: moneyNumber(i.gstRate) }));
    if (!lines.length) throw new BusinessRuleError('Add at least one invoice line (repair bookings need a quotation line).');

    const invoice = await runInTransaction(async (tx) => {
      await this.repo.lockBooking(booking.id, tx);
      if (await this.repo.findActiveInvoiceForBooking(booking.id, tx)) throw new ConflictError(ErrorMessages.INVOICE_EXISTS);
      return this.createInTx(tx, actor, {
        customerId: booking.customerId,
        branchId: booking.branchId,
        bookingId: booking.id,
        lines,
        opts: input,
        snapshotExtra: { bookingNumber: booking.bookingNumber, serviceDate: booking.scheduledDate },
      });
    });
    await this.afterCreate(actor, invoice.id, meta);
    return this.repo.findInvoice(invoice.id);
  }

  async createManual(actor: AuthUser, input: { customerId: number; branchId: number; applyGst: boolean; isInterState: boolean; discount: number; isFreeService: boolean; lines: InvoiceLineInput[]; notes?: string | null }, meta: RequestMeta) {
    assertBranchAccess(actor, input.branchId);
    const invoice = await runInTransaction((tx) => this.createInTx(tx, actor, { customerId: input.customerId, branchId: input.branchId, lines: input.lines, opts: input }));
    await this.afterCreate(actor, invoice.id, meta);
    return this.repo.findInvoice(invoice.id);
  }

  private async afterCreate(actor: AuthUser, invoiceId: number, meta: RequestMeta) {
    const inv = await this.repo.findInvoice(invoiceId);
    if (!inv) return;
    await this.settings.audit(actor, AuditActions.CREATE, 'invoice', inv.id, null, { invoiceNumber: inv.invoiceNumber, grandTotal: inv.grandTotal }, meta);
    const customer = await this.customers.findById(inv.customerId);
    await this.notifications.notify({
      userId: customer?.user?.id,
      event: NotificationEvents.INVOICE_GENERATED,
      data: { invoiceNumber: inv.invoiceNumber, amount: formatInr(inv.grandTotal) },
      dedupeKey: `invoice:${inv.id}:generated`,
    });
  }

  /** Cancels via a REVERSAL ledger entry; invoices with verified payments must be refunded first. */
  async cancel(actor: AuthUser, id: number, reason: string, meta: RequestMeta) {
    const inv = await this.get(actor, id);
    if (inv.status === 'CANCELLED') throw new BusinessRuleError(ErrorMessages.INVOICE_CANCELLED);
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockInvoice(id, tx);
      if (!locked || locked.status === 'CANCELLED') throw new BusinessRuleError(ErrorMessages.INVOICE_CANCELLED);
      if (Number(locked.amountPaid) > 0) throw new BusinessRuleError(ErrorMessages.INVOICE_HAS_PAYMENTS);
      await this.repo.updateInvoice(id, { status: 'CANCELLED', cancelledAt: new Date(), balanceDue: 0, notes: `${locked.notes ? `${locked.notes}\n` : ''}Cancelled: ${reason}` }, tx);
      await this.ledger.post(tx, {
        customerId: locked.customerId,
        entryType: 'REVERSAL',
        referenceType: ReferenceTypes.INVOICE,
        referenceId: id,
        referenceNumber: locked.invoiceNumber,
        description: `Reversal of ${locked.invoiceNumber}: ${reason}`,
        credit: locked.grandTotal,
        createdById: actor.id,
      });
    });
    await this.settings.audit(actor, AuditActions.STATUS_CHANGE, 'invoice', id, { status: inv.status }, { status: 'CANCELLED', reason }, meta);
    return this.repo.findInvoice(id);
  }

  /** Applies a verified payment to an invoice (inside a transaction). */
  async applyPayment(tx: Db, invoiceId: number, amount: number) {
    const inv = await this.repo.lockInvoice(invoiceId, tx);
    if (!inv) throw new NotFoundError('Invoice');
    if (inv.status === 'CANCELLED') throw new BusinessRuleError(ErrorMessages.INVOICE_CANCELLED);
    const paid = r2(Number(inv.amountPaid) + amount);
    const balance = r2(Number(inv.grandTotal) - paid);
    if (balance < -0.001) throw new BusinessRuleError(ErrorMessages.PAYMENT_EXCEEDS_BALANCE);
    await this.repo.updateInvoice(invoiceId, { amountPaid: paid, balanceDue: Math.max(0, balance), status: balance <= 0 ? 'PAID' : 'PARTIALLY_PAID' }, tx);
    if (inv.bookingId) await this.repo.setBookingPaymentStatus(inv.bookingId, balance <= 0 ? 'PAID' : 'PARTIALLY_PAID', tx);
    return inv;
  }

  /** Reverses a refunded amount on an invoice. */
  async unapplyPayment(tx: Db, invoiceId: number, amount: number) {
    const inv = await this.repo.lockInvoice(invoiceId, tx);
    if (!inv) return;
    const paid = Math.max(0, r2(Number(inv.amountPaid) - amount));
    const balance = r2(Number(inv.grandTotal) - paid);
    await this.repo.updateInvoice(invoiceId, { amountPaid: paid, balanceDue: balance, status: inv.status === 'CANCELLED' ? 'CANCELLED' : paid > 0 ? 'PARTIALLY_PAID' : 'ISSUED' }, tx);
  }

  findMany(ids: number[]) {
    return this.repo.findInvoicesByIds(ids);
  }
}
