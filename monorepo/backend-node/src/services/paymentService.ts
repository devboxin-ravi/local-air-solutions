/**
 * Payments: manual (UPI/cash/bank) recording, customer UPI submissions, admin verification,
 * Razorpay orders + signature/webhook verification (idempotent), and refunds.
 * Only VERIFIED payments affect invoices and the ledger.
 */

import Razorpay from 'razorpay';
import { PaymentMethod, Prisma } from '@prisma/client';
import { config } from '../config';
import { AuditActions, ErrorCodes, ErrorMessages, NotificationEvents, NumberPrefixes, ReferenceTypes } from '../constants';
import { Razorpay as RazorpayConst } from '../constants/integrations';
import { FinanceRepository } from '../repositories/financeRepository';
import { BookingRepository } from '../repositories/bookingRepository';
import { CustomerRepository } from '../repositories/customerRepository';
import { AmcRepository } from '../repositories/amcRepository';
import { Db, nextSequence, runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { AppError, BusinessRuleError, ConflictError, IntegrationDisabledError, NotFoundError, ValidationError } from '../utils/errors';
import { StatusCodes } from '../constants/api';
import { formatDocNumber, formatInr, hmacSha256Hex, moneyNumber, parseDateOnly, safeEqual, toPageMeta, toPageParams } from '../utils/helpers';
import { logger } from '../utils/logger';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { BookingService } from './bookingService';
import { AmcService } from './amcService';
import { InvoiceService } from './invoiceService';
import { LedgerService } from './ledgerService';
import { NotificationService } from './notificationService';
import { SettingsService } from './settingsService';

interface PaymentTarget {
  customerId: number;
  invoiceId?: number | null;
  bookingId?: number | null;
  amcContractId?: number | null;
}

export class PaymentService {
  private razorpay: Razorpay | null = null;

  constructor(
    private readonly repo: FinanceRepository,
    private readonly bookingsRepo: BookingRepository,
    private readonly customers: CustomerRepository,
    private readonly amcRepo: AmcRepository,
    private readonly invoices: InvoiceService,
    private readonly ledger: LedgerService,
    private readonly bookingService: BookingService,
    private readonly amc: AmcService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
  ) {}

  private gateway(): Razorpay {
    if (!config.razorpay.enabled) throw new IntegrationDisabledError(ErrorMessages.RAZORPAY_DISABLED);
    if (!this.razorpay) this.razorpay = new Razorpay({ key_id: config.razorpay.keyId as string, key_secret: config.razorpay.keySecret as string });
    return this.razorpay;
  }

  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; branchId?: number; status?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'REFUNDED' | 'FAILED'; method?: PaymentMethod; customerId?: number; from?: string; to?: string }) {
    const isCustomer = actor.userType === 'CUSTOMER';
    const branchId = isCustomer ? undefined : resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.PaymentWhereInput = {
      ...(isCustomer ? { customerId: actor.customerId ?? -1 } : q.customerId ? { customerId: q.customerId } : {}),
      ...(branchId ? { customer: { branchId } } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.method ? { method: q.method } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) } } : {}),
      ...(q.search ? { OR: [{ paymentNumber: { contains: q.search } }, { referenceNumber: { contains: q.search } }, { customer: { fullName: { contains: q.search } } }] } : {}),
    };
    const { items, total } = await this.repo.listPayments(where, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async get(actor: AuthUser, id: number) {
    const pmt = await this.repo.findPayment(id);
    if (!pmt) throw new NotFoundError('Payment');
    if (actor.userType === 'CUSTOMER' && pmt.customerId !== actor.customerId) throw new NotFoundError('Payment');
    if (actor.userType !== 'CUSTOMER') {
      const c = await this.customers.findById(pmt.customerId);
      if (c?.branchId) assertBranchAccess(actor, c.branchId);
    }
    return pmt;
  }

  /** Ensures the referenced invoice/booking/AMC belongs to the customer. */
  private async validateTarget(t: PaymentTarget) {
    if (t.invoiceId) {
      const inv = await this.repo.findInvoice(t.invoiceId);
      if (!inv || inv.customerId !== t.customerId) throw new ValidationError('Invoice does not belong to this customer');
      if (inv.status === 'CANCELLED') throw new BusinessRuleError(ErrorMessages.INVOICE_CANCELLED);
      return { invoice: inv };
    }
    if (t.bookingId) {
      const b = await this.bookingsRepo.findPlain(t.bookingId);
      if (!b || b.customerId !== t.customerId) throw new ValidationError('Booking does not belong to this customer');
    }
    if (t.amcContractId) {
      const a = await this.amcRepo.findById(t.amcContractId);
      if (!a || a.customerId !== t.customerId) throw new ValidationError('AMC does not belong to this customer');
    }
    return { invoice: null };
  }

  private async newPaymentNumber(tx: Db) {
    const year = new Date().getFullYear();
    return formatDocNumber(NumberPrefixes.PAYMENT, year, await nextSequence(tx, `PAYMENT-${year}`));
  }

  /** Marks a payment VERIFIED and applies it to invoice / booking / AMC + ledger. Inside a transaction. */
  private async settle(tx: Db, paymentId: number, actorId: number | null, note?: string | null) {
    const pmt = await this.repo.lockPayment(paymentId, tx);
    if (!pmt) throw new NotFoundError('Payment');
    if (pmt.status === 'VERIFIED') return pmt;
    if (pmt.status !== 'PENDING_VERIFICATION') throw new BusinessRuleError(ErrorMessages.PAYMENT_ALREADY_PROCESSED);
    const amount = moneyNumber(pmt.amount);

    let invoiceId = pmt.invoiceId;
    if (!invoiceId && pmt.amcContractId) invoiceId = (await this.repo.findActiveInvoiceForAmc(pmt.amcContractId, tx))?.id ?? null;
    if (!invoiceId && pmt.bookingId) invoiceId = (await this.repo.findActiveInvoiceForBooking(pmt.bookingId, tx))?.id ?? null;
    if (invoiceId) await this.invoices.applyPayment(tx, invoiceId, amount);

    await this.repo.updatePayment(paymentId, { status: 'VERIFIED', verifiedById: actorId, verifiedAt: new Date(), verificationNote: note ?? null, invoiceId }, tx);
    await this.ledger.post(tx, {
      customerId: pmt.customerId,
      entryType: 'PAYMENT',
      referenceType: ReferenceTypes.PAYMENT,
      referenceId: pmt.id,
      referenceNumber: pmt.paymentNumber,
      description: `Payment received (${pmt.method.replace('_', ' ')}${pmt.referenceNumber ? ` ref ${pmt.referenceNumber}` : ''})`,
      credit: amount,
      createdById: actorId,
    });

    // Prepaid booking flow: confirm the booking once paid.
    if (pmt.bookingId && !invoiceId) {
      const booking = await this.bookingsRepo.lockById(pmt.bookingId, tx);
      if (booking) {
        const paidSoFar = await this.repo.sumVerifiedForBooking(booking.id, tx);
        const total = moneyNumber(paidSoFar._sum.amount ?? 0);
        await this.bookingsRepo.update(booking.id, { paymentStatus: total >= moneyNumber(booking.estimatedTotal) ? 'PAID' : 'PARTIALLY_PAID' }, tx);
        if (booking.status === 'PENDING_PAYMENT' || booking.status === 'PAYMENT_VERIFICATION') {
          await this.bookingService.applyTransition(tx, booking, 'CONFIRMED', actorId, 'Payment verified');
        }
      }
    }
    // AMC activation on payment.
    if (pmt.amcContractId) {
      const amc = await this.amcRepo.lockById(pmt.amcContractId, tx);
      if (amc && amc.status === 'PENDING_PAYMENT') await this.amcRepo.update(amc.id, { status: 'ACTIVE', activatedAt: new Date() }, tx);
    }
    return pmt;
  }

  private async notifyReceived(paymentId: number) {
    const pmt = await this.repo.findPayment(paymentId);
    if (!pmt) return;
    if (pmt.amcContractId) await this.amc.ensureVisitsScheduled(pmt.amcContractId);
    const c = await this.customers.findById(pmt.customerId);
    await this.notifications.notify({
      userId: c?.user?.id,
      event: NotificationEvents.PAYMENT_RECEIVED,
      data: { amount: formatInr(pmt.amount), reference: pmt.referenceNumber ?? pmt.paymentNumber },
      dedupeKey: `payment:${pmt.id}:received`,
    });
  }

  /** Admin records a payment. Cash/bank entered by staff with approve permission are verified immediately. */
  async record(actor: AuthUser, input: PaymentTarget & { method: 'UPI_MANUAL' | 'CASH' | 'BANK_TRANSFER'; amount: number; referenceNumber?: string | null; receivedAt?: string; note?: string | null }, autoVerify: boolean, idempotencyKey: string | undefined, meta: RequestMeta) {
    if (idempotencyKey) {
      const existing = await this.repo.findPaymentByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }
    const customer = await this.customers.findById(input.customerId);
    if (!customer) throw new NotFoundError('Customer');
    if (customer.branchId) assertBranchAccess(actor, customer.branchId);
    const { invoice } = await this.validateTarget(input);
    if (invoice && input.amount > moneyNumber(invoice.balanceDue) + 0.001) throw new BusinessRuleError(ErrorMessages.PAYMENT_EXCEEDS_BALANCE);
    if (input.referenceNumber && (await this.repo.findPaymentByReference(input.method, input.referenceNumber))) throw new ConflictError(ErrorMessages.DUPLICATE_PAYMENT_REFERENCE);

    const pmt = await runInTransaction(async (tx) => {
      const created = await this.repo.createPayment(
        {
          paymentNumber: await this.newPaymentNumber(tx),
          customerId: input.customerId,
          invoiceId: input.invoiceId ?? null,
          bookingId: input.bookingId ?? invoice?.bookingId ?? null,
          amcContractId: input.amcContractId ?? invoice?.amcContractId ?? null,
          method: input.method,
          amount: input.amount,
          referenceNumber: input.referenceNumber ?? null,
          receivedAt: input.receivedAt ? parseDateOnly(input.receivedAt) : new Date(),
          idempotencyKey: idempotencyKey ?? null,
          createdById: actor.id,
          verificationNote: input.note ?? null,
        },
        tx,
      );
      if (autoVerify) await this.settle(tx, created.id, actor.id, input.note);
      return created;
    });
    await this.settings.audit(actor, AuditActions.CREATE, 'payment', pmt.id, null, { ...input, autoVerify }, meta);
    if (autoVerify) await this.notifyReceived(pmt.id);
    return this.repo.findPayment(pmt.id);
  }

  /** Customer submits a UPI reference (+ optional screenshot) for admin verification. */
  async submitUpi(actor: AuthUser, input: { bookingId?: number | null; invoiceId?: number | null; amcContractId?: number | null; amount: number; referenceNumber: string }, proofPath: string | null, idempotencyKey?: string) {
    if (!actor.customerId) throw new BusinessRuleError(ErrorMessages.NO_CUSTOMER_PROFILE);
    const paymentSettings = await this.settings.payment();
    if (!paymentSettings.upiEnabled) throw new BusinessRuleError('UPI payments are currently disabled.');
    if (idempotencyKey) {
      const existing = await this.repo.findPaymentByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }
    const target = { ...input, customerId: actor.customerId };
    await this.validateTarget(target);
    if (await this.repo.findPaymentByReference('UPI_MANUAL', input.referenceNumber)) throw new ConflictError(ErrorMessages.DUPLICATE_PAYMENT_REFERENCE);
    const pmt = await runInTransaction(async (tx) => {
      const created = await this.repo.createPayment(
        {
          paymentNumber: await this.newPaymentNumber(tx),
          customerId: actor.customerId as number,
          invoiceId: input.invoiceId ?? null,
          bookingId: input.bookingId ?? null,
          amcContractId: input.amcContractId ?? null,
          method: 'UPI_MANUAL',
          amount: input.amount,
          referenceNumber: input.referenceNumber,
          proofPath,
          idempotencyKey: idempotencyKey ?? null,
          createdById: actor.id,
        },
        tx,
      );
      if (input.bookingId) {
        const b = await this.bookingsRepo.lockById(input.bookingId, tx);
        if (b?.status === 'PENDING_PAYMENT') await this.bookingService.applyTransition(tx, b, 'PAYMENT_VERIFICATION', actor.id, `UPI ref ${input.referenceNumber} submitted`);
        if (b) await this.bookingsRepo.update(b.id, { paymentStatus: 'PENDING_VERIFICATION', paymentMethod: 'UPI_MANUAL' }, tx);
      }
      return created;
    });
    return this.repo.findPayment(pmt.id);
  }

  async verify(actor: AuthUser, id: number, approve: boolean, note: string | null | undefined, meta: RequestMeta) {
    const pmt = await this.get(actor, id);
    if (pmt.status !== 'PENDING_VERIFICATION') throw new BusinessRuleError(ErrorMessages.PAYMENT_ALREADY_PROCESSED);
    await runInTransaction(async (tx) => {
      if (approve) {
        await this.settle(tx, id, actor.id, note);
      } else {
        const locked = await this.repo.lockPayment(id, tx);
        if (locked?.status !== 'PENDING_VERIFICATION') throw new BusinessRuleError(ErrorMessages.PAYMENT_ALREADY_PROCESSED);
        await this.repo.updatePayment(id, { status: 'REJECTED', verifiedById: actor.id, verifiedAt: new Date(), verificationNote: note ?? null }, tx);
        if (locked.bookingId) {
          const b = await this.bookingsRepo.lockById(locked.bookingId, tx);
          if (b?.status === 'PAYMENT_VERIFICATION') await this.bookingService.applyTransition(tx, b, 'PENDING_PAYMENT', actor.id, `Payment rejected: ${note ?? ''}`);
          if (b) await this.bookingsRepo.update(b.id, { paymentStatus: 'UNPAID' }, tx);
        }
      }
    });
    await this.settings.audit(actor, approve ? AuditActions.APPROVE : AuditActions.REJECT, 'payment', id, { status: pmt.status }, { approve, note }, meta);
    if (approve) await this.notifyReceived(id);
    else {
      const c = await this.customers.findById(pmt.customerId);
      await this.notifications.notify({ userId: c?.user?.id, event: NotificationEvents.PAYMENT_REJECTED, data: { reference: pmt.referenceNumber ?? pmt.paymentNumber, note: note ?? '' } });
    }
    return this.repo.findPayment(id);
  }

  /** Refund: append-only — ledger REFUND (debit) and invoice re-opened by the refunded amount. */
  async refund(actor: AuthUser, id: number, amount: number, reason: string, meta: RequestMeta) {
    const pmt = await this.get(actor, id);
    if (pmt.status !== 'VERIFIED') throw new BusinessRuleError('Only verified payments can be refunded.');
    if (amount > moneyNumber(pmt.amount)) throw new BusinessRuleError('Refund exceeds payment amount.');
    if (pmt.method === 'RAZORPAY') {
      const gw = await this.repo.findGatewayTxnByPayment(id);
      if (gw?.gatewayPaymentId) await this.gateway().payments.refund(gw.gatewayPaymentId, { amount: Math.round(amount * RazorpayConst.PAISE_PER_RUPEE) });
    }
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockPayment(id, tx);
      if (locked?.status !== 'VERIFIED') throw new BusinessRuleError(ErrorMessages.PAYMENT_ALREADY_PROCESSED);
      if (amount >= moneyNumber(locked.amount)) await this.repo.updatePayment(id, { status: 'REFUNDED', verificationNote: reason }, tx);
      if (locked.invoiceId) await this.invoices.unapplyPayment(tx, locked.invoiceId, amount);
      await this.ledger.post(tx, {
        customerId: locked.customerId,
        entryType: 'REFUND',
        referenceType: ReferenceTypes.PAYMENT,
        referenceId: locked.id,
        referenceNumber: locked.paymentNumber,
        description: `Refund: ${reason}`,
        debit: amount,
        createdById: actor.id,
      });
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'payment', id, null, { refund: amount, reason }, meta);
    return this.repo.findPayment(id);
  }

  // ─── Razorpay ───
  private async amountDue(t: PaymentTarget): Promise<number> {
    if (t.invoiceId) {
      const inv = await this.repo.findInvoice(t.invoiceId);
      if (!inv || inv.customerId !== t.customerId) throw new NotFoundError('Invoice');
      return moneyNumber(inv.balanceDue);
    }
    if (t.bookingId) {
      const b = await this.bookingsRepo.findPlain(t.bookingId);
      if (!b || b.customerId !== t.customerId) throw new NotFoundError('Booking');
      return moneyNumber(b.estimatedTotal);
    }
    if (t.amcContractId) {
      const inv = await this.repo.findActiveInvoiceForAmc(t.amcContractId);
      if (!inv || inv.customerId !== t.customerId) throw new NotFoundError('AMC invoice');
      return moneyNumber(inv.balanceDue);
    }
    throw new ValidationError('Specify invoice, booking or AMC to pay for');
  }

  /** Server-side order creation. The amount is computed on the server, never trusted from the client. */
  async createRazorpayOrder(actor: AuthUser, input: { invoiceId?: number | null; bookingId?: number | null; amcContractId?: number | null }) {
    const paymentSettings = await this.settings.payment();
    if (!paymentSettings.razorpayEnabled) throw new IntegrationDisabledError(ErrorMessages.RAZORPAY_DISABLED);
    if (!actor.customerId) throw new BusinessRuleError(ErrorMessages.NO_CUSTOMER_PROFILE);
    const target = { ...input, customerId: actor.customerId };
    const amount = await this.amountDue(target);
    if (amount <= 0) throw new BusinessRuleError('Nothing to pay.');
    const order = await this.gateway().orders.create({
      amount: Math.round(amount * RazorpayConst.PAISE_PER_RUPEE),
      currency: RazorpayConst.CURRENCY,
      receipt: `c${actor.customerId}-${Date.now()}`,
      notes: { customerId: String(actor.customerId), invoiceId: String(input.invoiceId ?? ''), bookingId: String(input.bookingId ?? ''), amcContractId: String(input.amcContractId ?? '') },
    });
    await this.repo.createGatewayTxn({
      orderId: order.id,
      customerId: actor.customerId,
      bookingId: input.bookingId ?? null,
      invoiceId: input.invoiceId ?? null,
      amount,
      status: RazorpayConst.STATUS.CREATED,
      rawPayload: JSON.parse(JSON.stringify({ order, amcContractId: input.amcContractId ?? null })) as Prisma.InputJsonValue,
    });
    return { orderId: order.id, amount, currency: RazorpayConst.CURRENCY, keyId: config.razorpay.keyId };
  }

  /** Idempotently records a captured gateway payment and settles it. */
  private async captureGatewayPayment(orderId: string, gatewayPaymentId: string, payload: unknown) {
    return runInTransaction(async (tx) => {
      const txn = await this.repo.lockGatewayTxnByOrder(orderId, tx);
      if (!txn) throw new NotFoundError('Payment order');
      if (txn.status === RazorpayConst.STATUS.PAID && txn.paymentId) return txn.paymentId; // duplicate callback/webhook
      const raw = (txn.rawPayload as { amcContractId?: number | null } | null) ?? {};
      const pmt = await this.repo.createPayment(
        {
          paymentNumber: await this.newPaymentNumber(tx),
          customerId: txn.customerId,
          invoiceId: txn.invoiceId,
          bookingId: txn.bookingId,
          amcContractId: raw.amcContractId ?? null,
          method: 'RAZORPAY',
          amount: txn.amount,
          referenceNumber: gatewayPaymentId,
          idempotencyKey: `rzp:${gatewayPaymentId}`,
        },
        tx,
      );
      await this.repo.updateGatewayTxn(txn.id, { status: RazorpayConst.STATUS.PAID, gatewayPaymentId, paymentId: pmt.id, rawPayload: JSON.parse(JSON.stringify({ ...raw, capture: payload })) as Prisma.InputJsonValue }, tx);
      await this.settle(tx, pmt.id, null, 'Razorpay verified');
      return pmt.id;
    });
  }

  async verifyRazorpayCheckout(actor: AuthUser, input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    if (!config.razorpay.enabled) throw new IntegrationDisabledError(ErrorMessages.RAZORPAY_DISABLED);
    const expected = hmacSha256Hex(config.razorpay.keySecret as string, `${input.razorpay_order_id}|${input.razorpay_payment_id}`);
    if (!safeEqual(expected, input.razorpay_signature)) {
      throw new AppError(ErrorMessages.RAZORPAY_SIGNATURE_INVALID, StatusCodes.BAD_REQUEST, ErrorCodes.PAYMENT_VERIFICATION_FAILED);
    }
    const txn = await this.repo.findGatewayTxnByOrder(input.razorpay_order_id);
    if (!txn || txn.customerId !== actor.customerId) throw new NotFoundError('Payment order');
    const paymentId = await this.captureGatewayPayment(input.razorpay_order_id, input.razorpay_payment_id, { via: 'checkout' });
    await this.notifyReceived(paymentId);
    return this.repo.findPayment(paymentId);
  }

  /** Webhook: signature verified over the raw body; duplicate events are ignored. */
  async handleRazorpayWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!config.razorpay.webhookSecret) throw new IntegrationDisabledError(ErrorMessages.RAZORPAY_DISABLED);
    if (!rawBody || !signature || !safeEqual(hmacSha256Hex(config.razorpay.webhookSecret, rawBody), signature)) {
      throw new AppError(ErrorMessages.RAZORPAY_SIGNATURE_INVALID, StatusCodes.BAD_REQUEST, ErrorCodes.PAYMENT_VERIFICATION_FAILED);
    }
    const event = JSON.parse(rawBody.toString('utf8')) as { event: string; payload: { payment?: { entity: { id: string; order_id: string } } } };
    const entity = event.payload.payment?.entity;
    if (!entity?.order_id) return { ignored: true };
    if (event.event === RazorpayConst.EVENTS.PAYMENT_CAPTURED || event.event === RazorpayConst.EVENTS.ORDER_PAID) {
      const paymentId = await this.captureGatewayPayment(entity.order_id, entity.id, { via: 'webhook', event: event.event });
      await this.notifyReceived(paymentId);
      return { processed: true };
    }
    if (event.event === RazorpayConst.EVENTS.PAYMENT_FAILED) {
      const txn = await this.repo.findGatewayTxnByOrder(entity.order_id);
      if (txn && txn.status === RazorpayConst.STATUS.CREATED) await this.repo.updateGatewayTxn(txn.id, { status: RazorpayConst.STATUS.FAILED });
      return { processed: true };
    }
    logger.info('Unhandled Razorpay event', { event: event.event });
    return { ignored: true };
  }
}
