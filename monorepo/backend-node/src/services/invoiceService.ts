/**
 * Invoices: GST-aware calculation (grand total rounded up to the rupee), "For Invoice" drafts raised
 * when a job is completed (edited, then approved by an auditor), manual and AMC invoices,
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
import { logger } from '../utils/logger';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { LedgerService } from './ledgerService';
import { NotificationService } from './notificationService';
import { SettingsService } from './settingsService';
import { StockService } from './stockService';

export interface InvoiceOptions {
  applyGst: boolean;
  isInterState: boolean;
  discount: number;
  isFreeService: boolean;
  notes?: string | null;
}

/** GST invoices have tax on them; non-GST invoices have none. */
export type GstFilter = 'GST' | 'NON_GST';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Grand totals are rounded up to the next whole rupee, never down. */
const roundUp = (n: number) => Math.ceil(r2(n) - 1e-9) || 0; // `|| 0` turns -0 (zero bills) into 0

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
    return { serviceId: l.serviceId, stockItemId: l.stockItemId, description: l.description, quantity: l.quantity, rate: l.rate, discount: r2(l.lineDiscount + share), gstRate: l.gstRate, amount: l.gross };
  });

  const discount = r2(lineDiscounts + invoiceDiscount);
  const taxableAmount = r2(subtotal - discount);
  const cgst = opts.isInterState ? 0 : r2(gstTotal / 2);
  const sgst = opts.isInterState ? 0 : r2(gstTotal - cgst);
  const igst = opts.isInterState ? gstTotal : 0;
  const exact = r2(taxableAmount + gstTotal);
  const grandTotal = roundUp(exact);
  return { lines: out, subtotal, discount, taxableAmount, cgst, sgst, igst, gstTotal, roundOff: r2(grandTotal - exact), grandTotal };
}

type InvoiceArgs = { customerId: number; branchId: number; bookingId?: number | null; amcContractId?: number | null; lines: InvoiceLineInput[]; opts: InvoiceOptions; snapshotExtra?: Record<string, unknown> };
type DraftEdit = InvoiceOptions & { lines: InvoiceLineInput[] };

export class InvoiceService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly bookings: BookingRepository,
    private readonly customers: CustomerRepository,
    private readonly master: MasterDataRepository,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
    private readonly stock: StockService,
  ) {}

  private filters(q: { search?: string; from?: string; to?: string; gst?: GstFilter }): Prisma.InvoiceWhereInput {
    return {
      ...(q.gst === 'GST' ? { gstTotal: { gt: 0 } } : q.gst === 'NON_GST' ? { gstTotal: 0 } : {}),
      ...(q.from || q.to ? { invoiceDate: { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) } } : {}),
      ...(q.search ? { OR: [{ invoiceNumber: { contains: q.search } }, { customer: { fullName: { contains: q.search } } }, { customer: { mobile: { contains: q.search } } }, { booking: { bookingNumber: { contains: q.search } } }] } : {}),
    };
  }

  /** Issued invoices. Drafts live in "For Invoice" until approved. */
  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; sortOrder?: 'asc' | 'desc'; branchId?: number; status?: 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'; customerId?: number; from?: string; to?: string; isFreeService?: boolean; outstandingOnly?: boolean; gst?: GstFilter }) {
    const isCustomer = actor.userType === 'CUSTOMER';
    const branchId = isCustomer ? undefined : resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.InvoiceWhereInput = {
      status: { not: 'DRAFT' },
      ...(branchId ? { branchId } : {}),
      ...(isCustomer ? { customerId: actor.customerId ?? -1 } : q.customerId ? { customerId: q.customerId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.isFreeService !== undefined ? { isFreeService: q.isFreeService } : {}),
      ...(q.outstandingOnly ? { balanceDue: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } } : {}),
      ...this.filters(q),
    };
    const { items, total } = await this.repo.listInvoices(where, { invoiceDate: q.sortOrder ?? 'desc' }, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async get(actor: AuthUser, id: number) {
    const inv = await this.repo.findInvoice(id);
    if (!inv) throw new NotFoundError('Invoice');
    if (actor.userType === 'CUSTOMER') {
      if (inv.customerId !== actor.customerId || inv.status === 'DRAFT') throw new NotFoundError('Invoice');
    } else assertBranchAccess(actor, inv.branchId);
    return this.withDetails(inv);
  }

  /** Invoice for a signed public PDF link (no login): never a cancelled or unapproved one. */
  async getForShareLink(id: number) {
    const inv = await this.repo.findInvoice(id);
    if (!inv || inv.status === 'CANCELLED' || inv.status === 'DRAFT') throw new NotFoundError('Invoice');
    return this.withDetails(inv);
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

  /** Invoices of an AMC contract or AMC visit show how much of the contract is used, as of today. */
  private async withDetails<T extends { snapshot: Prisma.JsonValue; amcContractId: number | null; booking: { amcVisit: { visitNumber: number; amcContractId: number } | null } | null }>(inv: T) {
    const full = await this.withCompanyProfile(inv);
    const visit = inv.booking?.amcVisit ?? null;
    const contractId = inv.amcContractId ?? visit?.amcContractId;
    const amc = contractId ? await this.repo.findAmcUsage(contractId) : null;
    if (!amc) return { ...full, amcUsage: null };
    const usedVisits = amc.visits.filter((v) => v.status === 'COMPLETED').length;
    return {
      ...full,
      amcUsage: {
        amcNumber: amc.amcNumber,
        startDate: amc.startDate,
        endDate: amc.endDate,
        totalVisits: amc.totalVisits,
        usedVisits,
        remainingVisits: Math.max(0, amc.totalVisits - usedVisits),
        visitNumber: visit?.visitNumber ?? null,
        asOn: new Date(),
      },
    };
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

  /** Totals and invoice columns shared by drafts and issued invoices. */
  private async priced(tx: Db, args: InvoiceArgs) {
    const gst = await this.settings.gst(tx);
    const applyGst = args.opts.applyGst && gst.enabled;
    const totals = calculateInvoice(args.lines, { ...args.opts, applyGst });
    const hsnCodes = await this.stock.hsnCodes(tx, args.lines);
    const columns = {
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxableAmount: totals.taxableAmount,
      applyGst,
      isInterState: args.opts.isInterState,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      gstTotal: totals.gstTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      isFreeService: args.opts.isFreeService,
      notes: args.opts.notes ?? null,
    };
    const items = totals.lines.map((l) => ({
      serviceId: l.serviceId ?? null,
      stockItemId: l.stockItemId ?? null,
      description: l.description,
      hsnSac: (l.stockItemId ? hsnCodes.get(l.stockItemId) : null) ?? gst.sacCode,
      quantity: l.quantity,
      rate: round2(l.rate),
      discount: round2(l.discount),
      gstRate: round2(l.gstRate),
      amount: round2(l.amount),
    }));
    return { gst, totals, columns, items };
  }

  /**
   * Issues an invoice inside the given transaction: stock, number, prepaid payments, ledger debit.
   * With `draftId` the approved draft becomes the invoice (same record).
   */
  private async issueInTx(tx: Db, actor: AuthUser, args: InvoiceArgs, draftId?: number) {
    await this.stock.consume(tx, args.branchId, args.lines);
    const { gst, totals, columns, items } = await this.priced(tx, args);
    const year = new Date().getFullYear();
    const invoiceNumber = formatDocNumber(NumberPrefixes.INVOICE, year, await nextSequence(tx, `INVOICE-${year}`));
    const snapshot = await this.buildSnapshot(args.customerId, args.branchId, { sacCode: gst.sacCode, ...(args.snapshotExtra ?? {}) }, tx);

    // Prepaid payments already verified against the booking/AMC are applied to this invoice.
    const prepaid = await this.repo.findUnappliedVerifiedPayments({ bookingId: args.bookingId, amcContractId: args.amcContractId }, tx);
    const prepaidSum = moneyNumber(prepaid.reduce((s, p) => s + Number(p.amount), 0));
    const amountPaid = Math.min(prepaidSum, totals.grandTotal);
    const balanceDue = r2(totals.grandTotal - amountPaid);
    const data = {
      ...columns,
      invoiceNumber,
      invoiceDate: new Date(),
      amountPaid,
      balanceDue,
      status: balanceDue <= 0 ? ('PAID' as const) : amountPaid > 0 ? ('PARTIALLY_PAID' as const) : ('ISSUED' as const),
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
    };

    let invoiceId: number;
    if (draftId) {
      await this.repo.updateInvoice(draftId, data, tx);
      await this.repo.replaceInvoiceItems(draftId, items, tx);
      invoiceId = draftId;
    } else {
      const created = await this.repo.createInvoice(
        { ...data, customerId: args.customerId, branchId: args.branchId, bookingId: args.bookingId ?? null, amcContractId: args.amcContractId ?? null, createdById: actor.id },
        items,
        tx,
      );
      invoiceId = created.id;
    }
    if (prepaid.length) await this.repo.attachPaymentsToInvoice(prepaid.map((p) => p.id), invoiceId, tx);

    await this.ledger.post(tx, {
      customerId: args.customerId,
      entryType: 'INVOICE',
      referenceType: ReferenceTypes.INVOICE,
      referenceId: invoiceId,
      referenceNumber: invoiceNumber,
      description: args.opts.isFreeService ? `Free service invoice (value ₹${formatInr(totals.subtotal)})` : `Invoice ${invoiceNumber}`,
      debit: totals.grandTotal,
      createdById: actor.id,
    });
    if (args.bookingId) {
      await this.repo.setBookingPaymentStatus(args.bookingId, balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID', tx);
    }
    return { id: invoiceId };
  }

  /** Creates and issues an invoice (manual / AMC) inside the given transaction. */
  createInTx(tx: Db, actor: AuthUser, args: InvoiceArgs) {
    return this.issueInTx(tx, actor, args);
  }

  async createManual(actor: AuthUser, input: { customerId: number; branchId: number; applyGst: boolean; isInterState: boolean; discount: number; isFreeService: boolean; lines: InvoiceLineInput[]; notes?: string | null }, meta: RequestMeta) {
    assertBranchAccess(actor, input.branchId);
    const invoice = await runInTransaction((tx) => this.createInTx(tx, actor, { customerId: input.customerId, branchId: input.branchId, lines: input.lines, opts: input }));
    await this.afterIssue(actor, invoice.id, meta);
    return this.repo.findInvoice(invoice.id);
  }

  private async afterIssue(actor: AuthUser, invoiceId: number, meta: RequestMeta, action: string = AuditActions.CREATE) {
    const inv = await this.repo.findInvoice(invoiceId);
    if (!inv) return;
    await this.settings.audit(actor, action, 'invoice', inv.id, null, { invoiceNumber: inv.invoiceNumber, grandTotal: inv.grandTotal }, meta);
    const customer = await this.customers.findById(inv.customerId);
    await this.notifications.notify({
      userId: customer?.user?.id,
      event: NotificationEvents.INVOICE_GENERATED,
      data: { invoiceNumber: inv.invoiceNumber, amount: formatInr(inv.grandTotal) },
      dedupeKey: `invoice:${inv.id}:generated`,
    });
  }

  // ─── For Invoice (drafts) ───

  async listDrafts(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; sortOrder?: 'asc' | 'desc'; branchId?: number; from?: string; to?: string; gst?: GstFilter }) {
    const branchId = resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.InvoiceWhereInput = { status: 'DRAFT', ...(branchId ? { branchId } : {}), ...this.filters(q) };
    const { items, total } = await this.repo.listInvoices(where, { invoiceDate: q.sortOrder ?? 'desc' }, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async getDraft(actor: AuthUser, id: number) {
    const inv = await this.repo.findInvoice(id);
    if (!inv || inv.status !== 'DRAFT') throw new NotFoundError('Draft invoice');
    assertBranchAccess(actor, inv.branchId);
    return this.withDetails(inv);
  }

  /** The booking's services (including extra work) as invoice lines. */
  private bookingLines(booking: { items: Array<{ serviceId: number; serviceName: string; quantity: number; unitPrice: Prisma.Decimal; gstRate: Prisma.Decimal }> }): InvoiceLineInput[] {
    return booking.items.map((i) => ({ serviceId: i.serviceId, description: i.serviceName, quantity: i.quantity, rate: moneyNumber(i.unitPrice), discount: 0, gstRate: moneyNumber(i.gstRate) }));
  }

  /** Writes a draft for a completed booking. Nothing is billed, numbered or deducted until approval. */
  private async draftInTx(tx: Db, actorId: number | null, booking: { id: number; bookingNumber: string; customerId: number; branchId: number; scheduledDate: Date }, lines: InvoiceLineInput[], opts: InvoiceOptions) {
    await this.repo.lockBooking(booking.id, tx);
    if (await this.repo.findOpenInvoiceForBooking(booking.id, tx)) throw new ConflictError(ErrorMessages.INVOICE_EXISTS);
    const args: InvoiceArgs = { customerId: booking.customerId, branchId: booking.branchId, bookingId: booking.id, lines, opts };
    const { gst, columns, items } = await this.priced(tx, args);
    const year = new Date().getFullYear();
    const snapshot = await this.buildSnapshot(booking.customerId, booking.branchId, { sacCode: gst.sacCode, bookingNumber: booking.bookingNumber, serviceDate: booking.scheduledDate }, tx);
    return this.repo.createInvoice(
      {
        ...columns,
        invoiceNumber: formatDocNumber(NumberPrefixes.DRAFT_INVOICE, year, await nextSequence(tx, `DRAFT-INVOICE-${year}`)),
        customerId: booking.customerId,
        branchId: booking.branchId,
        bookingId: booking.id,
        amountPaid: 0,
        balanceDue: columns.grandTotal,
        status: 'DRAFT',
        snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
        createdById: actorId,
      },
      items,
      tx,
    );
  }

  /**
   * Called when a job is completed: puts its bill into "For Invoice". Never fails the completion —
   * bookings without services (e.g. undiagnosed repairs) or with a bill already are skipped.
   */
  async draftForCompletedBooking(actor: AuthUser, bookingId: number) {
    try {
      const booking = await this.bookings.findById(bookingId);
      if (!booking || booking.status !== 'COMPLETED' || !booking.items.length) return;
      const lines = this.bookingLines(booking);
      // Nothing to bill (AMC visit or free service without paid extra work): no bill to approve.
      if (lines.every((l) => l.rate === 0)) return;
      const gst = await this.settings.gst();
      await runInTransaction((tx) => this.draftInTx(tx, actor.id, booking, lines, { applyGst: gst.enabled, isInterState: false, discount: 0, isFreeService: false }));
    } catch (e) {
      if (!(e instanceof ConflictError)) logger.warn('Draft invoice not created', { bookingId, error: (e as Error).message });
    }
  }

  /** "Generate" from a completed booking into For Invoice (when no draft was made automatically). */
  async generateDraft(actor: AuthUser, input: { bookingId: number; applyGst: boolean; isInterState: boolean; discount: number; isFreeService: boolean; lines?: InvoiceLineInput[]; notes?: string | null }, meta: RequestMeta) {
    const booking = await this.bookings.findById(input.bookingId);
    if (!booking) throw new NotFoundError('Booking');
    assertBranchAccess(actor, booking.branchId);
    if (booking.status !== 'COMPLETED') throw new BusinessRuleError(ErrorMessages.BOOKING_NOT_COMPLETED);
    const lines = input.lines ?? this.bookingLines(booking);
    if (!lines.length) throw new BusinessRuleError('Add at least one invoice line (repair bookings need a quotation line).');
    const draft = await runInTransaction((tx) => this.draftInTx(tx, actor.id, booking, lines, input));
    await this.settings.audit(actor, AuditActions.CREATE, 'draftInvoice', draft.id, null, { bookingId: booking.id, grandTotal: draft.grandTotal }, meta);
    return this.repo.findInvoice(draft.id);
  }

  async updateDraft(actor: AuthUser, id: number, input: DraftEdit, meta: RequestMeta) {
    const before = await this.getDraft(actor, id);
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockInvoice(id, tx);
      if (locked?.status !== 'DRAFT') throw new BusinessRuleError(ErrorMessages.DRAFT_NOT_PENDING);
      const { columns, items } = await this.priced(tx, { customerId: locked.customerId, branchId: locked.branchId, lines: input.lines, opts: input });
      await this.repo.updateInvoice(id, { ...columns, balanceDue: columns.grandTotal }, tx);
      await this.repo.replaceInvoiceItems(id, items, tx);
    });
    const after = await this.repo.findInvoice(id);
    await this.settings.audit(
      actor,
      AuditActions.UPDATE,
      'draftInvoice',
      id,
      { grandTotal: before.grandTotal, applyGst: before.applyGst, lines: before.items.map((i) => `${i.description} x${i.quantity} @${i.rate}`) },
      { grandTotal: after?.grandTotal, applyGst: after?.applyGst, lines: after?.items.map((i) => `${i.description} x${i.quantity} @${i.rate}`) },
      meta,
    );
    return after;
  }

  /** Audit approval: the draft is issued as a numbered invoice and billed to the customer. */
  async approveDraft(actor: AuthUser, id: number, meta: RequestMeta) {
    const draft = await this.getDraft(actor, id);
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockInvoice(id, tx);
      if (locked?.status !== 'DRAFT') throw new BusinessRuleError(ErrorMessages.DRAFT_NOT_PENDING);
      const snap = (draft.snapshot ?? {}) as Record<string, unknown>;
      await this.issueInTx(
        tx,
        actor,
        {
          customerId: draft.customerId,
          branchId: draft.branchId,
          bookingId: draft.bookingId,
          // Stored per-line discounts already include the invoice-level discount.
          lines: draft.items.map((i) => ({ serviceId: i.serviceId, stockItemId: i.stockItemId, description: i.description, quantity: i.quantity, rate: moneyNumber(i.rate), discount: moneyNumber(i.discount), gstRate: moneyNumber(i.gstRate) })),
          opts: { applyGst: draft.applyGst, isInterState: draft.isInterState, discount: 0, isFreeService: draft.isFreeService, notes: draft.notes },
          snapshotExtra: { bookingNumber: snap.bookingNumber, serviceDate: snap.serviceDate },
        },
        id,
      );
    });
    await this.afterIssue(actor, id, meta, AuditActions.APPROVE);
    return this.repo.findInvoice(id);
  }

  /** Throws away a draft (e.g. a job that must not be billed); it can be generated again later. */
  async discardDraft(actor: AuthUser, id: number, reason: string, meta: RequestMeta) {
    const draft = await this.getDraft(actor, id);
    await this.repo.deleteDraftInvoice(id);
    await this.settings.audit(actor, AuditActions.DELETE, 'draftInvoice', id, { invoiceNumber: draft.invoiceNumber, bookingId: draft.bookingId, grandTotal: draft.grandTotal }, { reason }, meta);
  }

  /** Cancels via a REVERSAL ledger entry; invoices with verified payments must be refunded first. */
  async cancel(actor: AuthUser, id: number, reason: string, meta: RequestMeta) {
    const inv = await this.get(actor, id);
    if (inv.status === 'CANCELLED') throw new BusinessRuleError(ErrorMessages.INVOICE_CANCELLED);
    if (inv.status === 'DRAFT') throw new BusinessRuleError(ErrorMessages.DRAFT_NOT_ISSUED);
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockInvoice(id, tx);
      if (!locked || locked.status === 'CANCELLED') throw new BusinessRuleError(ErrorMessages.INVOICE_CANCELLED);
      if (Number(locked.amountPaid) > 0) throw new BusinessRuleError(ErrorMessages.INVOICE_HAS_PAYMENTS);
      await this.repo.updateInvoice(id, { status: 'CANCELLED', cancelledAt: new Date(), balanceDue: 0, notes: `${locked.notes ? `${locked.notes}\n` : ''}Cancelled: ${reason}` }, tx);
      await this.stock.restore(tx, inv.items);
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

  /**
   * Applies a verified payment to an invoice (inside a transaction). With `capAtBalance`, money taken
   * before the bill was finalised (e.g. GST later removed) settles the invoice and the excess stays as
   * customer credit in the ledger instead of failing.
   */
  async applyPayment(tx: Db, invoiceId: number, requested: number, capAtBalance = false) {
    const inv = await this.repo.lockInvoice(invoiceId, tx);
    if (!inv) throw new NotFoundError('Invoice');
    if (inv.status === 'CANCELLED') throw new BusinessRuleError(ErrorMessages.INVOICE_CANCELLED);
    if (inv.status === 'DRAFT') throw new BusinessRuleError(ErrorMessages.DRAFT_NOT_ISSUED);
    const amount = capAtBalance ? Math.min(requested, Number(inv.balanceDue)) : requested;
    if (amount <= 0) return inv;
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

  async findMany(ids: number[]) {
    const invoices = await this.repo.findInvoicesByIds(ids);
    return Promise.all(invoices.filter((inv) => inv.status !== 'DRAFT').map((inv) => this.withDetails(inv)));
  }
}
