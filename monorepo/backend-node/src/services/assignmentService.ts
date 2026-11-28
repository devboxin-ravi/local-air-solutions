/**
 * Technician assignment (admin side) and the technician field-app job workflow.
 */

import { BookingStatus, Prisma } from '@prisma/client';
import { ACTIVE_JOB_STATUSES, Assignment, AuditActions, ErrorMessages, NotificationEvents, PENDING_BOOKING_STATUSES } from '../constants';
import { BookingRepository } from '../repositories/bookingRepository';
import { StaffRepository } from '../repositories/staffRepository';
import { Db, runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta, TechnicianSuggestion, UploadedFileInfo } from '../models';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../utils/errors';
import { addDays, formatDisplayDate, generateOtp, parseDateOnly, round2, sha256, todayDateOnly, toPageMeta, toPageParams } from '../utils/helpers';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { BookingService } from './bookingService';
import { CatalogService } from './catalogService';
import { NotificationService } from './notificationService';
import { ReminderService } from './reminderService';
import { SettingsService } from './settingsService';
import { InvoiceService } from './invoiceService';

const ASSIGNABLE: BookingStatus[] = ['CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'RESCHEDULED'];
/** The technician is at the site: extra work can be billed. */
const EXTRA_WORK_STATUSES: BookingStatus[] = ['ARRIVED', 'IN_PROGRESS'];
const FINDING_STATUSES: BookingStatus[] = ['ARRIVED', 'IN_PROGRESS', 'COMPLETED'];

export class AssignmentService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly staff: StaffRepository,
    private readonly bookingService: BookingService,
    private readonly catalog: CatalogService,
    private readonly reminders: ReminderService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
    private readonly invoices: InvoiceService,
  ) {}

  // ─── Admin ───
  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; branchId?: number; status?: 'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'; staffId?: number; from?: string; to?: string; currentOnly?: boolean }) {
    const branchId = resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.TechnicianAssignmentWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.staffId ? { staffId: q.staffId } : {}),
      ...(q.currentOnly ? { isCurrent: true } : {}),
      booking: {
        ...(branchId ? { branchId } : {}),
        ...(q.from || q.to ? { scheduledDate: { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: parseDateOnly(q.to) } : {}) } } : {}),
        ...(q.search ? { OR: [{ bookingNumber: { contains: q.search } }, { customer: { fullName: { contains: q.search } } }] } : {}),
      },
    };
    const { items, total } = await this.bookings.listAssignments(where, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  /** Ranks technicians by branch, area coverage, skills, availability and workload. */
  async suggest(actor: AuthUser, bookingId: number): Promise<TechnicianSuggestion[]> {
    const b = await this.bookingService.get(actor, bookingId);
    const serviceIds = b.items.map((i) => i.serviceId);
    const candidates = await this.staff.findAll({ branchId: b.branchId, isTechnician: true, user: { status: 'ACTIVE', deletedAt: null } });
    const requiredSkills = await this.requiredSkillIds(serviceIds);
    const ids = candidates.map((c) => c.id);
    const [active, onDate] = await Promise.all([
      this.staff.workload(ids, ACTIVE_JOB_STATUSES),
      this.staff.workload(ids, [...ACTIVE_JOB_STATUSES, 'CONFIRMED'], b.scheduledDate),
    ]);
    const areaId = b.address.serviceArea?.id;
    return candidates
      .map((c) => {
        const reasons: string[] = ['Same branch'];
        let score = 0;
        const coversArea = !!areaId && c.serviceAreas.some((a) => a.serviceArea.id === areaId);
        if (coversArea) {
          score += Assignment.SCORE_SAME_AREA;
          reasons.push('Covers service area');
        }
        const matched = c.skills.filter((s) => requiredSkills.includes(s.skill.id));
        if (matched.length) {
          score += matched.length * Assignment.SCORE_PER_SKILL;
          reasons.push(`${matched.length} matching skill(s)`);
        }
        if (c.isAvailable) {
          score += Assignment.SCORE_AVAILABLE;
          reasons.push('Available');
        }
        const jobsOnDate = onDate.get(c.id) ?? 0;
        score -= jobsOnDate * Assignment.WORKLOAD_PENALTY;
        return {
          staffId: c.id,
          userId: c.userId,
          name: c.user.name,
          mobile: c.user.mobile,
          staffCode: c.staffCode,
          score,
          reasons,
          activeJobs: active.get(c.id) ?? 0,
          jobsOnDate,
          matchedSkills: matched.map((m) => m.skill.name),
          coversArea,
          isAvailable: c.isAvailable,
        };
      })
      .sort((a, b2) => b2.score - a.score)
      .slice(0, Assignment.SUGGESTION_LIMIT);
  }

  private async requiredSkillIds(serviceIds: number[]): Promise<number[]> {
    if (!serviceIds.length) return [];
    return this.catalog.skillIdsForServices(serviceIds);
  }

  async assign(actor: AuthUser, bookingId: number, staffId: number, notes: string | null | undefined, meta: RequestMeta, schedule: { scheduledDate?: string; scheduledTime?: string } = {}) {
    const b = await this.bookingService.get(actor, bookingId);
    const tech = await this.staff.findById(staffId);
    if (!tech || tech.branchId !== b.branchId || tech.user.status !== 'ACTIVE') throw new BusinessRuleError(ErrorMessages.TECHNICIAN_NOT_ELIGIBLE);
    assertBranchAccess(actor, tech.branchId);

    await runInTransaction(async (tx) => {
      const locked = await this.bookings.lockById(bookingId, tx);
      if (!locked) throw new NotFoundError('Booking');
      if (!ASSIGNABLE.includes(locked.status)) throw new BusinessRuleError(ErrorMessages.BOOKING_NOT_ASSIGNABLE);
      const current = await this.bookings.findById(bookingId, tx);
      if (!current) throw new NotFoundError('Booking');
      const rescheduled = await this.bookingService.applyManualSchedule(tx, current, schedule);
      let state = rescheduled ? { ...locked, slotId: null } : locked;
      if (locked.status === 'ACCEPTED') {
        await this.bookingService.applyTransition(tx, locked, 'CONFIRMED', actor.id, 'Technician changed');
        state = { ...locked, status: 'CONFIRMED' };
      }
      await this.bookings.closeCurrentAssignments(bookingId, 'CANCELLED', tx);
      await this.bookings.createAssignment({ bookingId, staffId, assignedById: actor.id, notes: notes ?? null }, tx);
      if (state.status === 'ASSIGNED') {
        await this.bookings.addStatusHistory({ bookingId, fromStatus: 'ASSIGNED', toStatus: 'ASSIGNED', note: `Reassigned to ${tech.user.name}`, actorUserId: actor.id }, tx);
      } else {
        await this.bookingService.applyTransition(tx, state, 'ASSIGNED', actor.id, `Assigned to ${tech.user.name}`);
      }
    });
    await this.settings.audit(actor, AuditActions.ASSIGN, 'booking', bookingId, null, { staffId, ...schedule }, meta);

    const visit = (await this.bookings.findById(bookingId)) ?? b;
    const when = [formatDisplayDate(visit.scheduledDate), visit.scheduledTime].filter(Boolean).join(', ');
    const area = b.address.serviceArea?.name ?? b.address.city.name;
    await this.notifications.notify({
      userId: tech.userId,
      event: NotificationEvents.NEW_JOB,
      data: { bookingNumber: b.bookingNumber, date: when, area },
    });
    await this.notifications.notify({
      userId: b.customer.userId,
      event: NotificationEvents.TECHNICIAN_ASSIGNED,
      data: { bookingNumber: b.bookingNumber, technicianName: tech.user.name },
    });
    return this.bookings.findById(bookingId);
  }

  async unassign(actor: AuthUser, bookingId: number, meta: RequestMeta) {
    return this.bookingService.changeStatus(actor, bookingId, 'CONFIRMED', 'Technician unassigned', meta);
  }

  /** Technician availability board for a date. */
  async availability(actor: AuthUser, branchId: number | undefined, date: string) {
    const scoped = resolveBranchScope(actor, branchId);
    const day = parseDateOnly(date);
    const staff = await this.staff.findAll({ isTechnician: true, user: { status: 'ACTIVE', deletedAt: null }, ...(scoped ? { branchId: scoped } : {}) });
    const ids = staff.map((s) => s.id);
    const [onDate, active] = await Promise.all([
      this.staff.workload(ids, [...ACTIVE_JOB_STATUSES, ...PENDING_BOOKING_STATUSES, 'COMPLETED'], day),
      this.staff.workload(ids, ACTIVE_JOB_STATUSES),
    ]);
    const jobs = await Promise.all(
      staff.map((s) =>
        this.bookings.findTechnicianJobs(s.id, { scheduledDate: day, status: { notIn: ['CANCELLED', 'REJECTED'] } }),
      ),
    );
    return staff.map((s, i) => ({
      staffId: s.id,
      name: s.user.name,
      staffCode: s.staffCode,
      mobile: s.user.mobile,
      branch: s.branch,
      isAvailable: s.isAvailable,
      workStartTime: s.workStartTime,
      workEndTime: s.workEndTime,
      skills: s.skills.map((k) => k.skill.name),
      serviceAreas: s.serviceAreas.map((a) => a.serviceArea.name),
      jobsOnDate: onDate.get(s.id) ?? 0,
      activeJobs: active.get(s.id) ?? 0,
      jobs: jobs[i].map((j) => ({ id: j.id, bookingNumber: j.bookingNumber, status: j.status, scheduledTime: j.scheduledTime, customer: j.customer.fullName })),
    }));
  }

  // ─── Technician app ───
  private requireStaff(actor: AuthUser): number {
    if (!actor.staffId) throw new ForbiddenError(ErrorMessages.NO_STAFF_PROFILE);
    return actor.staffId;
  }

  private async loadOwnJob(actor: AuthUser, bookingId: number) {
    const staffId = this.requireStaff(actor);
    const b = await this.bookings.findById(bookingId);
    const current = b?.assignments.find((a) => a.isCurrent);
    if (!b || !current || current.staffId !== staffId) throw new ForbiddenError(ErrorMessages.JOB_NOT_YOURS);
    return { booking: b, assignment: current, staffId };
  }

  async myDashboard(actor: AuthUser) {
    const staffId = this.requireStaff(actor);
    const today = todayDateOnly();
    const [todayJobs, pending, accepted, inProgress, completed] = await Promise.all([
      this.bookings.countTechnicianJobs(staffId, [...ACTIVE_JOB_STATUSES, 'COMPLETED'], today),
      this.bookings.countTechnicianJobs(staffId, ['ASSIGNED']),
      this.bookings.countTechnicianJobs(staffId, ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED']),
      this.bookings.countTechnicianJobs(staffId, ['IN_PROGRESS']),
      this.bookings.countTechnicianJobs(staffId, ['COMPLETED']),
    ]);
    return { todayJobs, pending, accepted, inProgress, completed };
  }

  async myJobs(actor: AuthUser, scope: 'today' | 'upcoming' | 'history' | 'active') {
    const staffId = this.requireStaff(actor);
    const today = todayDateOnly();
    const where: Prisma.ServiceBookingWhereInput =
      scope === 'today'
        ? { scheduledDate: today, status: { notIn: ['CANCELLED', 'REJECTED'] } }
        : scope === 'upcoming'
          ? { scheduledDate: { gte: addDays(today, 1) }, status: { in: ACTIVE_JOB_STATUSES } }
          : scope === 'active'
            ? { status: { in: ACTIVE_JOB_STATUSES } }
            : { status: { in: ['COMPLETED', 'CANCELLED'] } };
    return this.bookings.findTechnicianJobs(staffId, where);
  }

  async myJob(actor: AuthUser, bookingId: number) {
    const { booking } = await this.loadOwnJob(actor, bookingId);
    return booking;
  }

  async respond(actor: AuthUser, bookingId: number, accept: boolean, reason: string | null | undefined, meta: RequestMeta) {
    const { assignment, booking } = await this.loadOwnJob(actor, bookingId);
    if (assignment.status !== 'ASSIGNED') throw new BusinessRuleError('This job has already been responded to.');
    const general = await this.settings.general();
    if (!accept && !general.technicianCanReject) throw new ForbiddenError('Rejecting jobs is disabled by company policy.');

    await runInTransaction(async (tx) => {
      const locked = await this.bookings.lockById(bookingId, tx);
      if (!locked) throw new NotFoundError('Booking');
      if (accept) {
        await this.bookings.updateAssignment(assignment.id, { status: 'ACCEPTED', respondedAt: new Date() }, tx);
        await this.bookingService.applyTransition(tx, locked, 'ACCEPTED', actor.id, 'Accepted by technician');
      } else {
        await this.bookings.updateAssignment(assignment.id, { status: 'REJECTED', isCurrent: false, rejectReason: reason ?? null, respondedAt: new Date() }, tx);
        await this.bookings.update(bookingId, { status: 'CONFIRMED' }, tx);
        await this.bookings.addStatusHistory({ bookingId, fromStatus: locked.status, toStatus: 'CONFIRMED', note: `Rejected by technician${reason ? `: ${reason}` : ''}`, actorUserId: actor.id }, tx);
      }
    });
    await this.settings.audit(actor, accept ? AuditActions.APPROVE : AuditActions.REJECT, 'assignment', assignment.id, null, { reason }, meta);
    if (accept) {
      await this.notifications.notify({ userId: booking.customer.userId, event: NotificationEvents.ASSIGNMENT_ACCEPTED, data: { bookingNumber: booking.bookingNumber, technicianName: actor.name } });
    }
    return this.bookings.findById(bookingId);
  }

  async updateJobStatus(actor: AuthUser, bookingId: number, status: 'ON_THE_WAY' | 'ARRIVED' | 'IN_PROGRESS', note: string | null | undefined) {
    const { booking } = await this.loadOwnJob(actor, bookingId);
    const general = await this.settings.general();
    let otp: string | null = null;
    await runInTransaction(async (tx) => {
      const locked = await this.bookings.lockById(bookingId, tx);
      if (!locked) throw new NotFoundError('Booking');
      await this.bookingService.applyTransition(tx, locked, status, actor.id, note);
      if (status === 'IN_PROGRESS' && general.requireCompletionOtp) {
        otp = generateOtp();
        await this.bookings.update(bookingId, { completionOtpHash: sha256(`${bookingId}:${otp}`) }, tx);
      }
    });
    await this.bookingService.notifyStatus(bookingId, status);
    if (otp) {
      await this.notifications.notify({
        userId: booking.customer.userId,
        event: NotificationEvents.WORK_STARTED,
        data: { bookingNumber: `${booking.bookingNumber}. Share completion code ${otp} with the technician once the work is done` },
      });
    }
    return this.bookings.findById(bookingId);
  }

  async complete(actor: AuthUser, bookingId: number, input: { performedItemIds: number[]; note?: string | null; completionOtp?: string }, meta: RequestMeta) {
    const { booking, assignment } = await this.loadOwnJob(actor, bookingId);
    if (booking.completionOtpHash) {
      if (!input.completionOtp || sha256(`${bookingId}:${input.completionOtp}`) !== booking.completionOtpHash) {
        throw new BusinessRuleError(ErrorMessages.COMPLETION_OTP_INVALID);
      }
    }
    await runInTransaction(async (tx) => {
      const locked = await this.bookings.lockById(bookingId, tx);
      if (!locked) throw new NotFoundError('Booking');
      await this.bookingService.applyTransition(tx, locked, 'COMPLETED', actor.id, input.note ?? 'Job completed');
      await this.bookings.updateAssignment(assignment.id, { status: 'COMPLETED', completedAt: new Date() }, tx);
      const performed = input.performedItemIds.length ? input.performedItemIds : locked.items.map((i) => i.id);
      await this.bookings.markItemsPerformed(bookingId, performed, tx);
      if (input.note) await this.bookings.addNote({ bookingId, authorId: actor.id, note: input.note }, tx);
      if (locked.amcVisitId) await this.bookings.completeAmcVisit(locked.amcVisitId, tx);
      await this.reminders.scheduleForCompletedBooking(bookingId, tx);
    });
    await this.settings.audit(actor, AuditActions.STATUS_CHANGE, 'booking', bookingId, { status: booking.status }, { status: 'COMPLETED' }, meta);
    await this.bookingService.notifyStatus(bookingId, 'COMPLETED');
    await this.invoices.draftForCompletedBooking(actor, bookingId);
    return this.bookings.findById(bookingId);
  }

  /** Admin-side completion (e.g. technician without app access). */
  async adminComplete(actor: AuthUser, bookingId: number, note: string | null | undefined, meta: RequestMeta) {
    const b = await this.bookingService.get(actor, bookingId);
    await runInTransaction(async (tx) => {
      const locked = await this.bookings.lockById(bookingId, tx);
      if (!locked) throw new NotFoundError('Booking');
      await this.bookingService.applyTransition(tx, locked, 'COMPLETED', actor.id, note ?? 'Completed by admin');
      const current = b.assignments.find((a) => a.isCurrent);
      if (current) await this.bookings.updateAssignment(current.id, { status: 'COMPLETED', completedAt: new Date() }, tx);
      await this.bookings.markItemsPerformed(bookingId, locked.items.map((i) => i.id), tx);
      if (locked.amcVisitId) await this.bookings.completeAmcVisit(locked.amcVisitId, tx);
      await this.reminders.scheduleForCompletedBooking(bookingId, tx);
    });
    await this.settings.audit(actor, AuditActions.STATUS_CHANGE, 'booking', bookingId, { status: b.status }, { status: 'COMPLETED' }, meta);
    await this.bookingService.notifyStatus(bookingId, 'COMPLETED');
    await this.invoices.draftForCompletedBooking(actor, bookingId);
    return this.bookings.findById(bookingId);
  }

  async addJobNote(actor: AuthUser, bookingId: number, note: string) {
    await this.loadOwnJob(actor, bookingId);
    return this.bookings.addNote({ bookingId, authorId: actor.id, note });
  }

  /** Services done on top of the booking: added to the booking so they are billed with it. */
  async addExtraWork(actor: AuthUser, bookingId: number, input: { items: Array<{ serviceId: number; quantity: number }>; note?: string | null }, meta: RequestMeta) {
    const { booking } = await this.loadOwnJob(actor, bookingId);
    const services = input.items.length ? await this.catalog.resolveForBooking(input.items.map((i) => i.serviceId), booking.branchId) : [];
    const lines = input.items.map((item, idx) => {
      const s = services[idx];
      const unit = s.pricingType === 'FREE' || s.pricingType === 'QUOTATION' ? 0 : s.effectivePrice;
      return { bookingId, serviceId: s.id, serviceName: s.name, serviceCode: s.code, pricingType: s.pricingType, quantity: item.quantity, unitPrice: round2(unit), gstRate: round2(s.gstApplicable ? s.gstRate : 0), lineTotal: round2(unit * item.quantity), isExtra: true, isPerformed: true };
    });
    const added = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
    const summary = lines.map((l) => `${l.serviceName} x ${l.quantity}`).join(', ');

    await runInTransaction(async (tx) => {
      const current = await this.assertBillable(tx, bookingId);
      if (lines.length) {
        await this.bookings.addItems(lines, tx);
        await this.bookings.update(
          bookingId,
          {
            estimatedTotal: round2(Number(current.estimatedTotal) + added),
            // A fully paid booking (e.g. a free AMC visit) has money due again.
            ...(added > 0 && current.paymentStatus === 'PAID' ? { paymentStatus: current.payments.some((p) => p.status === 'VERIFIED') ? 'PARTIALLY_PAID' : 'UNPAID' } : {}),
          },
          tx,
        );
      }
      await this.bookings.addNote({ bookingId, authorId: actor.id, kind: 'EXTRA_WORK', note: [summary && `Added: ${summary}`, input.note].filter(Boolean).join('\n').slice(0, 1000) }, tx);
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'booking', bookingId, null, { extraWork: input }, meta);
    return this.bookings.findById(bookingId);
  }

  /** Undo of a wrongly added extra service, before the invoice exists. */
  async removeExtraItem(actor: AuthUser, bookingId: number, itemId: number, meta: RequestMeta) {
    await this.loadOwnJob(actor, bookingId);
    await runInTransaction(async (tx) => {
      const current = await this.assertBillable(tx, bookingId);
      const item = current.items.find((i) => i.id === itemId && i.isExtra);
      if (!item) throw new NotFoundError('Extra work item');
      await this.bookings.deleteItem(itemId, tx);
      await this.bookings.update(bookingId, { estimatedTotal: round2(Math.max(0, Number(current.estimatedTotal) - Number(item.lineTotal))) }, tx);
      await this.bookings.addNote({ bookingId, authorId: actor.id, kind: 'EXTRA_WORK', note: `Removed: ${item.serviceName} x ${item.quantity}` }, tx);
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'booking', bookingId, null, { removedExtraItem: itemId }, meta);
    return this.bookings.findById(bookingId);
  }

  private async assertBillable(tx: Db, bookingId: number) {
    await this.bookings.lockById(bookingId, tx);
    const current = await this.bookings.findById(bookingId, tx);
    if (!current) throw new NotFoundError('Booking');
    if (!EXTRA_WORK_STATUSES.includes(current.status)) throw new BusinessRuleError('Extra work can be changed only after arriving and before completing the job.');
    if (current.invoices.length) throw new BusinessRuleError('The invoice is already generated; ask the office to bill extra work.');
    return current;
  }

  /** On-site observation kept with author and time, optionally with a follow-up reminder. */
  async addFinding(actor: AuthUser, bookingId: number, input: { finding: string; followUpMonths?: number | null }, meta: RequestMeta) {
    const { booking } = await this.loadOwnJob(actor, bookingId);
    if (!FINDING_STATUSES.includes(booking.status)) throw new BusinessRuleError('Findings can be recorded after arriving at the site.');
    await runInTransaction(async (tx) => {
      await this.bookings.addNote({ bookingId, authorId: actor.id, kind: 'FINDING', note: input.finding }, tx);
      if (input.followUpMonths) await this.reminders.createFollowUp({ customerId: booking.customerId, bookingId, months: input.followUpMonths, note: `Follow-up: ${input.finding}` }, tx);
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'booking', bookingId, null, { finding: input }, meta);
    return this.bookings.findById(bookingId);
  }

  async uploadJobPhotos(actor: AuthUser, bookingId: number, kind: 'BEFORE' | 'AFTER' | 'OTHER', files: UploadedFileInfo[]) {
    await this.loadOwnJob(actor, bookingId);
    await this.bookings.addAttachments(files.map((f) => ({ bookingId, uploadedById: actor.id, kind, filePath: f.path, mimeType: f.mimeType, sizeBytes: f.size })));
    return this.bookings.listAttachments(bookingId);
  }
}
