/**
 * Annual Maintenance Contracts: create → invoice → payment → activate → schedule visits
 * → book/assign/complete visits (always linked to the original contract) → expiry tracking.
 */

import { Prisma } from '@prisma/client';
import { Amc, AuditActions, ErrorMessages, NotificationEvents, NumberPrefixes } from '../constants';
import { AmcRepository } from '../repositories/amcRepository';
import { CustomerRepository } from '../repositories/customerRepository';
import { BookingRepository } from '../repositories/bookingRepository';
import { nextSequence, runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { BusinessRuleError, NotFoundError, ValidationError } from '../utils/errors';
import { addDays, addMonths, compact, formatDisplayDate, formatDocNumber, moneyNumber, parseDateOnly, todayDateOnly, toPageMeta, toPageParams } from '../utils/helpers';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { AssignmentService } from './assignmentService';
import { BookingService } from './bookingService';
import { InvoiceService } from './invoiceService';
import { NotificationService } from './notificationService';
import { SettingsService } from './settingsService';

export interface AmcCreateInput {
  customerId: number;
  addressId: number;
  branchId: number;
  productDetails: string;
  serviceIds: number[];
  startDate: string;
  endDate: string;
  totalVisits: number;
  visitFrequencyMonths: number;
  contractAmount: number;
  applyGst: boolean;
  terms?: string | null;
}

export class AmcService {
  constructor(
    private readonly repo: AmcRepository,
    private readonly customers: CustomerRepository,
    private readonly bookingRepo: BookingRepository,
    private readonly invoices: InvoiceService,
    private readonly bookings: BookingService,
    private readonly assignments: AssignmentService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
  ) {}

  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; branchId?: number; status?: 'DRAFT' | 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CANCELLED'; customerId?: number; expiringWithinDays?: number }) {
    const isCustomer = actor.userType === 'CUSTOMER';
    const branchId = isCustomer ? undefined : resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.AmcContractWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(isCustomer ? { customerId: actor.customerId ?? -1, status: { not: 'DRAFT' } } : q.customerId ? { customerId: q.customerId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.expiringWithinDays ? { status: { in: ['ACTIVE', 'EXPIRING'] }, endDate: { lte: addDays(todayDateOnly(), q.expiringWithinDays), gte: todayDateOnly() } } : {}),
      ...(q.search ? { OR: [{ amcNumber: { contains: q.search } }, { customer: { fullName: { contains: q.search } } }, { customer: { mobile: { contains: q.search } } }] } : {}),
    };
    const { items, total } = await this.repo.list(where, p.skip, p.take);
    return {
      items: items.map(({ visits, ...a }) => ({ ...a, completedVisits: visits.length })),
      meta: toPageMeta(p, total),
    };
  }

  async get(actor: AuthUser, id: number) {
    const a = await this.repo.findById(id);
    if (!a) throw new NotFoundError('AMC contract');
    if (actor.userType === 'CUSTOMER') {
      if (a.customerId !== actor.customerId) throw new NotFoundError('AMC contract');
    } else assertBranchAccess(actor, a.branchId);
    return a;
  }

  private visitDates(start: Date, end: Date, total: number, freq: number): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < total; i += 1) {
      const d = addMonths(start, i * freq);
      if (d > end) break;
      dates.push(d);
    }
    return dates;
  }

  async create(actor: AuthUser, input: AmcCreateInput, meta: RequestMeta) {
    assertBranchAccess(actor, input.branchId);
    const address = await this.customers.findAddress(input.addressId);
    if (!address || address.customerId !== input.customerId) throw new ValidationError(ErrorMessages.ADDRESS_MISMATCH);
    const start = parseDateOnly(input.startDate);
    const end = parseDateOnly(input.endDate);
    const visits = this.visitDates(start, end, input.totalVisits, input.visitFrequencyMonths);
    if (visits.length < input.totalVisits) throw new ValidationError(`Only ${visits.length} visit(s) fit between the start and end dates with this frequency.`);

    const amc = await runInTransaction(async (tx) => {
      const year = new Date().getFullYear();
      const seq = await nextSequence(tx, `AMC-${year}`);
      return this.repo.create(
        {
          amcNumber: formatDocNumber(NumberPrefixes.AMC, year, seq),
          customerId: input.customerId,
          addressId: input.addressId,
          branchId: input.branchId,
          productDetails: input.productDetails,
          startDate: start,
          endDate: end,
          totalVisits: input.totalVisits,
          visitFrequencyMonths: input.visitFrequencyMonths,
          contractAmount: input.contractAmount,
          applyGst: input.applyGst,
          terms: input.terms ?? null,
          status: 'DRAFT',
          createdById: actor.id,
        },
        input.serviceIds,
        tx,
      );
    });
    await this.settings.audit(actor, AuditActions.CREATE, 'amc', amc.id, null, input, meta);
    return this.repo.findById(amc.id);
  }

  async update(actor: AuthUser, id: number, input: Partial<AmcCreateInput>, meta: RequestMeta) {
    const a = await this.get(actor, id);
    if (a.status !== 'DRAFT') throw new BusinessRuleError(ErrorMessages.AMC_INVALID_STATE(a.status));
    await runInTransaction(async (tx) => {
      const { serviceIds, startDate, endDate, ...rest } = input;
      await this.repo.update(
        id,
        compact({
          ...rest,
          startDate: startDate ? parseDateOnly(startDate) : undefined,
          endDate: endDate ? parseDateOnly(endDate) : undefined,
        }) as Prisma.AmcContractUncheckedUpdateInput,
        tx,
      );
      if (serviceIds) await this.repo.setServices(id, serviceIds, tx);
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'amc', id, null, input, meta);
    return this.repo.findById(id);
  }

  /** Generates the AMC invoice and moves the contract to PENDING_PAYMENT (or ACTIVE when free). */
  async issueInvoice(actor: AuthUser, id: number, meta: RequestMeta) {
    const a = await this.get(actor, id);
    if (a.status !== 'DRAFT') throw new BusinessRuleError(ErrorMessages.AMC_INVALID_STATE(a.status));
    const gst = await this.settings.gst();
    const amount = moneyNumber(a.contractAmount);
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockById(id, tx);
      if (locked?.status !== 'DRAFT') throw new BusinessRuleError(ErrorMessages.AMC_INVALID_STATE(locked?.status ?? 'UNKNOWN'));
      await this.invoices.createInTx(tx, actor, {
        customerId: a.customerId,
        branchId: a.branchId,
        amcContractId: a.id,
        lines: [
          {
            serviceId: null,
            description: `Annual Maintenance Contract ${a.amcNumber} — ${a.productDetails} (${a.totalVisits} visits, ${formatDisplayDate(a.startDate)} to ${formatDisplayDate(a.endDate)})`,
            quantity: 1,
            rate: amount,
            discount: 0,
            gstRate: a.applyGst ? gst.defaultRate : 0,
          },
        ],
        opts: { applyGst: a.applyGst, isInterState: false, discount: 0, isFreeService: amount === 0 },
        snapshotExtra: { amcNumber: a.amcNumber },
      });
      await this.repo.update(id, { status: amount === 0 ? 'ACTIVE' : 'PENDING_PAYMENT', activatedAt: amount === 0 ? new Date() : null }, tx);
      if (amount === 0) await this.scheduleVisitsInTx(tx, a);
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'amc', id, { status: a.status }, { status: 'PENDING_PAYMENT' }, meta);
    return this.repo.findById(id);
  }

  private async scheduleVisitsInTx(tx: Prisma.TransactionClient, a: { id: number; startDate: Date; endDate: Date; totalVisits: number; visitFrequencyMonths: number }) {
    const dates = this.visitDates(a.startDate, a.endDate, a.totalVisits, a.visitFrequencyMonths);
    await this.repo.createVisits(dates.map((d, i) => ({ amcContractId: a.id, visitNumber: i + 1, scheduledDate: d })), tx);
  }

  /** Manual activation (e.g. after an offline payment). Visits are scheduled on activation. */
  async activate(actor: AuthUser, id: number, meta: RequestMeta) {
    const a = await this.get(actor, id);
    if (!['PENDING_PAYMENT', 'ACTIVE'].includes(a.status)) throw new BusinessRuleError(ErrorMessages.AMC_INVALID_STATE(a.status));
    await runInTransaction(async (tx) => {
      if (a.status !== 'ACTIVE') await this.repo.update(id, { status: 'ACTIVE', activatedAt: new Date() }, tx);
      if (a.visits.length === 0) await this.scheduleVisitsInTx(tx, a);
    });
    await this.settings.audit(actor, AuditActions.APPROVE, 'amc', id, { status: a.status }, { status: 'ACTIVE' }, meta);
    return this.repo.findById(id);
  }

  /** Ensures visits exist for active contracts (payment-triggered activation). */
  async ensureVisitsScheduled(id: number) {
    const a = await this.repo.findById(id);
    if (a && a.status === 'ACTIVE' && a.visits.length === 0) await runInTransaction((tx) => this.scheduleVisitsInTx(tx, a));
  }

  async cancel(actor: AuthUser, id: number, reason: string, meta: RequestMeta) {
    const a = await this.get(actor, id);
    if (['CANCELLED', 'EXPIRED'].includes(a.status)) throw new BusinessRuleError(ErrorMessages.AMC_INVALID_STATE(a.status));
    await runInTransaction(async (tx) => {
      await this.repo.update(id, { status: 'CANCELLED', cancelledAt: new Date(), terms: `${a.terms ?? ''}\n\nCancelled: ${reason}`.trim() }, tx);
      for (const v of a.visits.filter((x) => x.status === 'SCHEDULED')) await this.repo.updateVisit(v.id, { status: 'CANCELLED' }, tx);
    });
    await this.settings.audit(actor, AuditActions.STATUS_CHANGE, 'amc', id, { status: a.status }, { status: 'CANCELLED', reason }, meta);
    return this.repo.findById(id);
  }

  async listVisits(actor: AuthUser, q: { page?: number; pageSize?: number; branchId?: number; status?: 'SCHEDULED' | 'BOOKED' | 'COMPLETED' | 'MISSED' | 'CANCELLED'; from?: string; to?: string; amcContractId?: number; search?: string }) {
    const branchId = resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.AmcVisitWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.amcContractId ? { amcContractId: q.amcContractId } : {}),
      ...(q.from || q.to ? { scheduledDate: { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: parseDateOnly(q.to) } : {}) } } : {}),
      amcContract: {
        ...(branchId ? { branchId } : {}),
        ...(q.search ? { OR: [{ amcNumber: { contains: q.search } }, { customer: { fullName: { contains: q.search } } }] } : {}),
      },
    };
    const { items, total } = await this.repo.listVisits(where, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  /** Creates a booking for an AMC visit (linked to the contract) and optionally assigns a technician. */
  async bookVisit(actor: AuthUser, visitId: number, input: { scheduledDate: string; slotId?: number | null; staffId?: number | null }, meta: RequestMeta) {
    const visit = await this.repo.findVisit(visitId);
    if (!visit) throw new NotFoundError('AMC visit');
    const amc = visit.amcContract;
    assertBranchAccess(actor, amc.branchId);
    if (amc.status !== 'ACTIVE' && amc.status !== 'EXPIRING') throw new BusinessRuleError(ErrorMessages.AMC_INVALID_STATE(amc.status));
    if (visit.status !== 'SCHEDULED' || visit.booking) throw new BusinessRuleError('This visit is already booked or closed.');

    const booking = await this.bookings.create(
      actor,
      {
        bookingType: 'SERVICE',
        customerId: amc.customerId,
        addressId: amc.addressId,
        branchId: amc.branchId,
        productId: null,
        items: amc.services.map((s) => ({ serviceId: s.serviceId, quantity: 1 })),
        scheduledDate: input.scheduledDate,
        slotId: input.slotId ?? null,
        problemCategory: null,
        problemDescription: null,
        instructions: `AMC ${amc.amcNumber} — visit ${visit.visitNumber} of ${amc.totalVisits}`,
        paymentMethod: null,
      },
      meta,
    );
    if (!booking) throw new NotFoundError('Booking');
    await runInTransaction(async (tx) => {
      // Covered under AMC: zero the booking value and link it to the visit.
      await this.bookingRepo.linkToAmcVisit(booking.id, visit.id, tx);
      await this.repo.updateVisit(visit.id, { status: 'BOOKED', scheduledDate: parseDateOnly(input.scheduledDate) }, tx);
    });
    if (input.staffId) await this.assignments.assign(actor, booking.id, input.staffId, `AMC ${amc.amcNumber} visit ${visit.visitNumber}`, meta);
    return this.repo.findVisit(visitId);
  }

  /** Job: mark EXPIRING / EXPIRED and notify customers before expiry. */
  async refreshStatuses(): Promise<void> {
    const today = todayDateOnly();
    const cfg = await this.settings.reminder();
    const window = addDays(today, cfg.amcExpiryNoticeDays ?? Amc.EXPIRING_WINDOW_DAYS);
    await this.repo.markStatuses({ status: { in: ['ACTIVE', 'EXPIRING'] }, endDate: { lt: today } }, 'EXPIRED');
    await this.repo.markStatuses({ status: 'ACTIVE', endDate: { gte: today, lte: window } }, 'EXPIRING');
    const expiring = await this.repo.findExpiring(window);
    for (const a of expiring.filter((x) => x.status === 'EXPIRING')) {
      await this.notifications.notify({
        userId: a.customer.userId,
        event: NotificationEvents.AMC_EXPIRING,
        data: { amcNumber: a.amcNumber, date: formatDisplayDate(a.endDate) },
        dedupeKey: `amc:${a.id}:expiring`,
      });
    }
  }
}
