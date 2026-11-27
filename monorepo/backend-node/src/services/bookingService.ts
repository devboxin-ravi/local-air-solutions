/**
 * Service & repair bookings: creation (admin + customer app), status workflow with
 * validated transitions and history, rescheduling, cancellation, notes and attachments.
 */

import { BookingStatus, Prisma } from '@prisma/client';
import {
  AuditActions,
  BOOKING_TRANSITIONS,
  ErrorCodes,
  ErrorMessages,
  NotificationEvents,
  NumberPrefixes,
  PaymentPolicies,
  SLOT_HOLDING_STATUSES,
} from '../constants';
import { BookingRepository } from '../repositories/bookingRepository';
import { CustomerRepository } from '../repositories/customerRepository';
import { UserRepository } from '../repositories/userRepository';
import { Db, nextSequence, runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta, UploadedFileInfo } from '../models';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { formatDisplayDate, formatDocNumber, moneyNumber, parseDateOnly, round2, todayDateOnly, toPageMeta, toPageParams } from '../utils/helpers';
import type { BookingCreateInput, BookingListQuery } from '../validations/operations';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { CatalogService } from './catalogService';
import { CustomerService } from './customerService';
import { NotificationService } from './notificationService';
import { SettingsService } from './settingsService';
import { SlotService } from './slotService';

const SORTABLE = ['createdAt', 'scheduledDate', 'bookingNumber', 'estimatedTotal', 'status'];

const STATUS_EVENTS: Partial<Record<BookingStatus, string>> = {
  CONFIRMED: NotificationEvents.BOOKING_CONFIRMED,
  ON_THE_WAY: NotificationEvents.ON_THE_WAY,
  ARRIVED: NotificationEvents.ARRIVED,
  IN_PROGRESS: NotificationEvents.WORK_STARTED,
  COMPLETED: NotificationEvents.SERVICE_COMPLETED,
};

export class BookingService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly customers: CustomerRepository,
    private readonly users: UserRepository,
    private readonly catalog: CatalogService,
    private readonly slots: SlotService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
    private readonly customerService: CustomerService,
  ) {}

  // ─── Read ───
  async list(actor: AuthUser, q: BookingListQuery) {
    const isCustomer = actor.userType === 'CUSTOMER';
    // Customers are always restricted to their own bookings, regardless of branch.
    if (isCustomer) q = { ...q, customerId: actor.customerId ?? -1, branchId: undefined };
    const branchId = isCustomer ? undefined : resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const statuses = Array.isArray(q.status) ? (q.status as BookingStatus[]) : q.status ? [q.status as BookingStatus] : undefined;
    const dateFilter =
      q.from || q.to
        ? {
            [q.dateField]: {
              ...(q.from ? { gte: parseDateOnly(q.from) } : {}),
              ...(q.to ? { lte: q.dateField === 'createdAt' ? new Date(`${q.to}T23:59:59.999Z`) : parseDateOnly(q.to) } : {}),
            },
          }
        : {};
    const where: Prisma.ServiceBookingWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(q.bookingType ? { bookingType: q.bookingType } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.serviceId ? { items: { some: { serviceId: q.serviceId } } } : {}),
      ...(q.staffId ? { assignments: { some: { staffId: q.staffId, isCurrent: true } } } : {}),
      ...(q.unassigned ? { assignments: { none: { isCurrent: true } } } : {}),
      ...(q.cityId ? { address: { cityId: q.cityId } } : {}),
      ...dateFilter,
      ...(q.search
        ? {
            OR: [
              { bookingNumber: { contains: q.search } },
              { customer: { fullName: { contains: q.search } } },
              { customer: { mobile: { contains: q.search } } },
              { items: { some: { serviceName: { contains: q.search } } } },
            ],
          }
        : {}),
    };
    const sortBy = q.sortBy && SORTABLE.includes(q.sortBy) ? q.sortBy : 'createdAt';
    const { items, total } = await this.repo.list(where, { [sortBy]: q.sortOrder }, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async calendar(actor: AuthUser, branchId: number | undefined, from: string, to: string) {
    const scoped = resolveBranchScope(actor, branchId);
    return this.repo.findForCalendar({
      ...(scoped ? { branchId: scoped } : {}),
      scheduledDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
      status: { notIn: ['CANCELLED', 'REJECTED'] },
    });
  }

  async get(actor: AuthUser, id: number) {
    const b = await this.repo.findById(id);
    if (!b) throw new NotFoundError('Booking');
    if (actor.userType === 'CUSTOMER') {
      if (b.customerId !== actor.customerId) throw new NotFoundError('Booking');
    } else if (actor.userType === 'STAFF') {
      if (!b.assignments.some((a) => a.isCurrent && a.staff.id === actor.staffId)) throw new ForbiddenError(ErrorMessages.JOB_NOT_YOURS);
    } else {
      assertBranchAccess(actor, b.branchId);
    }
    return b;
  }

  // ─── Create ───
  async create(actor: AuthUser, input: BookingCreateInput, meta: RequestMeta) {
    const isCustomer = actor.userType === 'CUSTOMER';
    const customerId = isCustomer ? actor.customerId : input.customerId;
    if (!customerId) throw new ValidationError(ErrorMessages.VALIDATION_FAILED, { customerId: 'Customer is required' });

    const customer = await this.customers.findById(customerId);
    if (!customer) throw new NotFoundError('Customer');
    const address = await this.customers.findAddress(input.addressId);
    if (!address || address.customerId !== customerId || !address.isActive) throw new ValidationError(ErrorMessages.ADDRESS_MISMATCH);

    const branchId =
      input.branchId ?? (await this.customerService.resolveAddressBranch(address)) ?? customer.branchId ?? (isCustomer ? null : actor.branchId);
    if (!branchId) throw new ValidationError(ErrorMessages.VALIDATION_FAILED, { branchId: 'Branch could not be determined for this address. Select a branch.' });
    if (!isCustomer) assertBranchAccess(actor, branchId);

    const scheduledDate = parseDateOnly(input.scheduledDate);
    if (scheduledDate < todayDateOnly()) throw new ValidationError(ErrorMessages.VALIDATION_FAILED, { scheduledDate: 'Date cannot be in the past' });

    const services = input.items.length ? await this.catalog.resolveForBooking(input.items.map((i) => i.serviceId), branchId) : [];
    const lines = input.items.map((item, idx) => {
      const s = services[idx];
      const unit = s.pricingType === 'FREE' || s.pricingType === 'QUOTATION' ? 0 : s.effectivePrice;
      return {
        serviceId: s.id,
        serviceName: s.name,
        serviceCode: s.code,
        pricingType: s.pricingType,
        quantity: item.quantity,
        unitPrice: round2(unit),
        gstRate: round2(s.gstApplicable ? s.gstRate : 0),
        lineTotal: round2(unit * item.quantity),
      };
    });
    const estimatedTotal = round2(lines.reduce((sum, l) => sum + Number(l.lineTotal), 0));

    const paymentSettings = await this.settings.payment();
    const prepaid = paymentSettings.policy === PaymentPolicies.PREPAID_REQUIRED && Number(estimatedTotal) > 0;
    const initialStatus: BookingStatus = prepaid ? 'PENDING_PAYMENT' : 'CONFIRMED';

    const addressSnapshot = {
      label: address.label,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      city: address.city.name,
      state: address.state.name,
      pincode: address.pincode,
      latitude: address.latitude ? Number(address.latitude) : null,
      longitude: address.longitude ? Number(address.longitude) : null,
    };

    const booking = await runInTransaction(async (tx) => {
      const year = new Date().getFullYear();
      const seq = await nextSequence(tx, `BOOKING-${year}`);
      const created = await this.repo.create(
        {
          bookingNumber: formatDocNumber(NumberPrefixes.BOOKING, year, seq),
          bookingType: input.bookingType,
          customerId,
          addressId: address.id,
          branchId,
          productId: input.productId ?? null,
          scheduledDate,
          problemCategory: input.problemCategory ?? null,
          problemDescription: input.problemDescription ?? null,
          instructions: input.instructions ?? null,
          status: initialStatus,
          paymentMethod: input.paymentMethod ?? null,
          estimatedTotal,
          source: isCustomer ? 'CUSTOMER_APP' : 'ADMIN',
          addressSnapshot,
          createdById: actor.id,
        },
        tx,
      );
      if (lines.length) await this.repo.createItems(lines.map((l) => ({ ...l, bookingId: created.id })), tx);
      if (input.slotId) {
        const slot = await this.slots.reserve(input.slotId, branchId, scheduledDate, created.id, tx);
        await this.repo.update(created.id, { slotId: slot.id, scheduledTime: `${slot.startTime}-${slot.endTime}` }, tx);
      }
      await this.repo.addStatusHistory({ bookingId: created.id, fromStatus: null, toStatus: initialStatus, note: 'Booking created', actorUserId: actor.id }, tx);
      return created;
    });

    await this.settings.audit(actor, AuditActions.CREATE, 'booking', booking.id, null, { bookingNumber: booking.bookingNumber }, meta);
    const data = { bookingNumber: booking.bookingNumber, date: formatDisplayDate(scheduledDate), slot: '' };
    await this.notifications.notify({ userId: customer.userId, event: initialStatus === 'CONFIRMED' ? NotificationEvents.BOOKING_CONFIRMED : NotificationEvents.BOOKING_CREATED, data, dedupeKey: `booking:${booking.id}:created` });
    const managers = await this.users.findUsersByRoles(['BRANCH_MANAGER', 'COMPANY_ADMIN'], branchId);
    await this.notifications.notifyMany(managers.map((m) => m.id).filter((id) => id !== actor.id), NotificationEvents.BOOKING_CREATED, data);
    return this.repo.findById(booking.id);
  }

  // ─── Status workflow ───
  /** Validates a transition and records history. Must be called inside a transaction holding the booking lock. */
  async applyTransition(db: Db, booking: { id: number; status: BookingStatus; slotId: number | null }, to: BookingStatus, actorId: number | null, note?: string | null) {
    if (!BOOKING_TRANSITIONS[booking.status].includes(to)) {
      throw new BusinessRuleError(ErrorMessages.INVALID_STATUS_TRANSITION(booking.status, to), ErrorCodes.INVALID_STATUS_TRANSITION);
    }
    const data: Prisma.ServiceBookingUncheckedUpdateInput = { status: to };
    if (to === 'COMPLETED') data.completedAt = new Date();
    if ((to === 'CANCELLED' || to === 'REJECTED') && SLOT_HOLDING_STATUSES.includes(booking.status)) {
      await this.slots.release(booking.slotId, booking.id, db);
      data.slotId = null;
      await this.repo.closeCurrentAssignments(booking.id, 'CANCELLED', db);
    }
    if (to === 'CONFIRMED' && (booking.status === 'ASSIGNED' || booking.status === 'ACCEPTED')) {
      // Unassigning returns the booking to the confirmed pool.
      await this.repo.closeCurrentAssignments(booking.id, 'CANCELLED', db);
    }
    await this.repo.update(booking.id, data, db);
    await this.repo.addStatusHistory({ bookingId: booking.id, fromStatus: booking.status, toStatus: to, note: note ?? null, actorUserId: actorId }, db);
  }

  async notifyStatus(bookingId: number, status: BookingStatus): Promise<void> {
    const event = STATUS_EVENTS[status];
    if (!event) return;
    const b = await this.repo.findById(bookingId);
    if (!b) return;
    const tech = b.assignments.find((a) => a.isCurrent);
    await this.notifications.notify({
      userId: b.customer.userId,
      event,
      data: {
        bookingNumber: b.bookingNumber,
        date: formatDisplayDate(b.scheduledDate),
        slot: b.scheduledTime ?? '',
        technicianName: tech?.staff.user.name ?? '',
      },
      dedupeKey: `booking:${b.id}:${status}:${b.statusHistory.length}`,
    });
  }

  async changeStatus(actor: AuthUser, id: number, to: BookingStatus, note: string | null | undefined, meta: RequestMeta) {
    const current = await this.get(actor, id);
    if (to === 'ASSIGNED') throw new BusinessRuleError('Use the assignment action to assign a technician.');
    if (to === 'COMPLETED' && current.status !== 'IN_PROGRESS') {
      throw new BusinessRuleError(ErrorMessages.INVALID_STATUS_TRANSITION(current.status, to), ErrorCodes.INVALID_STATUS_TRANSITION);
    }
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockById(id, tx);
      if (!locked) throw new NotFoundError('Booking');
      await this.applyTransition(tx, locked, to, actor.id, note);
    });
    await this.settings.audit(actor, AuditActions.STATUS_CHANGE, 'booking', id, { status: current.status }, { status: to, note }, meta);
    await this.notifyStatus(id, to);
    return this.repo.findById(id);
  }

  async cancel(actor: AuthUser, id: number, reason: string, meta: RequestMeta) {
    const b = await this.get(actor, id);
    if (actor.userType === 'CUSTOMER') {
      const general = await this.settings.general();
      const hoursUntil = (b.scheduledDate.getTime() - Date.now()) / 3_600_000;
      if (['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(b.status) || hoursUntil < general.allowCustomerCancellationHours - 24) {
        throw new BusinessRuleError('This booking can no longer be cancelled from the app. Please contact support.');
      }
    }
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockById(id, tx);
      if (!locked) throw new NotFoundError('Booking');
      await this.applyTransition(tx, locked, 'CANCELLED', actor.id, reason);
      await this.repo.update(id, { cancelReason: reason }, tx);
    });
    await this.settings.audit(actor, AuditActions.STATUS_CHANGE, 'booking', id, { status: b.status }, { status: 'CANCELLED', reason }, meta);
    return this.repo.findById(id);
  }

  async reschedule(actor: AuthUser, id: number, input: { scheduledDate: string; slotId?: number | null; note?: string | null }, meta: RequestMeta) {
    const b = await this.get(actor, id);
    const date = parseDateOnly(input.scheduledDate);
    if (date < todayDateOnly()) throw new ValidationError(ErrorMessages.VALIDATION_FAILED, { scheduledDate: 'Date cannot be in the past' });
    await runInTransaction(async (tx) => {
      const locked = await this.repo.lockById(id, tx);
      if (!locked) throw new NotFoundError('Booking');
      await this.applyTransition(tx, locked, 'RESCHEDULED', actor.id, input.note ?? `Rescheduled to ${input.scheduledDate}`);
      await this.slots.release(locked.slotId, id, tx);
      await this.repo.closeCurrentAssignments(id, 'CANCELLED', tx);
      let slotPatch: Prisma.ServiceBookingUncheckedUpdateInput = { slotId: null, scheduledTime: null };
      if (input.slotId) {
        const slot = await this.slots.reserve(input.slotId, locked.branchId, date, id, tx);
        slotPatch = { slotId: slot.id, scheduledTime: `${slot.startTime}-${slot.endTime}` };
      }
      await this.repo.update(id, { scheduledDate: date, ...slotPatch }, tx);
      await this.applyTransition(tx, { ...locked, status: 'RESCHEDULED' }, 'CONFIRMED', actor.id, 'Confirmed for new schedule');
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'booking', id, { scheduledDate: b.scheduledDate }, input, meta);
    await this.notifyStatus(id, 'CONFIRMED');
    return this.repo.findById(id);
  }

  async update(actor: AuthUser, id: number, input: { instructions?: string | null; problemDescription?: string | null; problemCategory?: string | null; productId?: number | null; items?: Array<{ serviceId: number; quantity: number }> }, meta: RequestMeta) {
    const b = await this.get(actor, id);
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status)) throw new BusinessRuleError('Closed bookings cannot be edited.');
    await runInTransaction(async (tx) => {
      const patch: Prisma.ServiceBookingUncheckedUpdateInput = {};
      if (input.instructions !== undefined) patch.instructions = input.instructions;
      if (input.problemDescription !== undefined) patch.problemDescription = input.problemDescription;
      if (input.problemCategory !== undefined) patch.problemCategory = input.problemCategory;
      if (input.productId !== undefined) patch.productId = input.productId;
      if (input.items) {
        const services = await this.catalog.resolveForBooking(input.items.map((i) => i.serviceId), b.branchId);
        const lines = input.items.map((it, idx) => {
          const s = services[idx];
          const unit = s.pricingType === 'FREE' || s.pricingType === 'QUOTATION' ? 0 : s.effectivePrice;
          return { bookingId: id, serviceId: s.id, serviceName: s.name, serviceCode: s.code, pricingType: s.pricingType, quantity: it.quantity, unitPrice: round2(unit), gstRate: round2(s.gstApplicable ? s.gstRate : 0), lineTotal: round2(unit * it.quantity) };
        });
        await this.repo.replaceItems(id, lines, tx);
        patch.estimatedTotal = round2(lines.reduce((s, l) => s + Number(l.lineTotal), 0));
      }
      await this.repo.update(id, patch, tx);
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'booking', id, null, input, meta);
    return this.repo.findById(id);
  }

  // ─── Notes & attachments ───
  async addNote(actor: AuthUser, id: number, note: string) {
    await this.get(actor, id);
    return this.repo.addNote({ bookingId: id, authorId: actor.id, note });
  }

  async addAttachments(actor: AuthUser, id: number, kind: 'BEFORE' | 'AFTER' | 'CUSTOMER_UPLOAD' | 'PAYMENT_PROOF' | 'OTHER', files: UploadedFileInfo[]) {
    await this.get(actor, id);
    if (!files.length) throw new ValidationError(ErrorMessages.FILE_REQUIRED);
    await this.repo.addAttachments(files.map((f) => ({ bookingId: id, uploadedById: actor.id, kind, filePath: f.path, mimeType: f.mimeType, sizeBytes: f.size })));
    return this.repo.listAttachments(id);
  }

  /** Summary used by the tracking timeline in the customer app. */
  async tracking(actor: AuthUser, id: number) {
    const b = await this.get(actor, id);
    const general = await this.settings.general();
    const tech = b.assignments.find((a) => a.isCurrent && a.status !== 'REJECTED');
    return {
      id: b.id,
      bookingNumber: b.bookingNumber,
      bookingType: b.bookingType,
      problemDescription: b.problemDescription,
      status: b.status,
      scheduledDate: b.scheduledDate,
      scheduledTime: b.scheduledTime,
      estimatedTotal: moneyNumber(b.estimatedTotal),
      paymentStatus: b.paymentStatus,
      items: b.items,
      address: b.addressSnapshot,
      timeline: b.statusHistory.map((h) => ({ status: h.toStatus, at: h.createdAt, note: h.note })),
      technician: tech
        ? { name: tech.staff.user.name, phone: general.showTechnicianPhoneToCustomer ? tech.staff.user.mobile : null }
        : null,
      invoices: b.invoices,
      payments: b.payments,
      attachments: b.attachments.filter((a) => a.kind !== 'PAYMENT_PROOF'),
    };
  }
}
