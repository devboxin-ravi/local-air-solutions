/**
 * Appointment slots: generation from working hours, availability listing,
 * and concurrency-safe reserve/release used by bookings.
 */

import { Prisma } from '@prisma/client';
import { AuditActions, ErrorCodes, ErrorMessages, Slots } from '../constants';
import { SlotRepository } from '../repositories/slotRepository';
import { Db } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { addDays, minutesToTime, parseDateOnly, timeToMinutes, todayDateOnly, toDateOnlyString } from '../utils/helpers';
import { assertBranchAccess, resolveBranchScope } from './accessControl';
import { SettingsService } from './settingsService';

export class SlotService {
  constructor(
    private readonly repo: SlotRepository,
    private readonly settings: SettingsService,
  ) {}

  async list(actor: AuthUser | null, q: { branchId?: number; from?: string; to?: string; availableOnly?: boolean }) {
    const branchId = actor && actor.userType !== 'CUSTOMER' ? resolveBranchScope(actor, q.branchId) : q.branchId;
    const from = q.from ? parseDateOnly(q.from) : todayDateOnly();
    const to = q.to ? parseDateOnly(q.to) : addDays(from, 14);
    const where: Prisma.AppointmentSlotWhereInput = {
      slotDate: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
      ...(q.availableOnly ? { isActive: true } : {}),
    };
    const slots = await this.repo.list(where);
    const rows = slots.map((s) => ({
      ...s,
      slotDate: toDateOnlyString(s.slotDate),
      available: Math.max(0, s.capacity - s.bookedCount),
    }));
    return q.availableOnly ? rows.filter((r) => r.available > 0 && r.isActive) : rows;
  }

  /** Customer-facing availability for a branch + date. Past times on "today" are excluded. */
  async availableFor(branchId: number, date: string) {
    const rows = await this.list(null, { branchId, from: date, to: date, availableOnly: true });
    const today = toDateOnlyString(new Date());
    if (date !== today) return rows;
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return rows.filter((r) => timeToMinutes(r.startTime) > nowMins);
  }

  async generate(
    actor: AuthUser,
    input: { branchId: number; fromDate: string; toDate: string; startTime?: string; endTime?: string; slotDurationMinutes?: number; capacity?: number; workingDays?: number[] },
    meta: RequestMeta,
  ) {
    assertBranchAccess(actor, input.branchId);
    const wh = await this.settings.workingHours();
    const start = timeToMinutes(input.startTime ?? wh.startTime);
    const end = timeToMinutes(input.endTime ?? wh.endTime);
    const duration = input.slotDurationMinutes ?? wh.slotDurationMinutes ?? Slots.DEFAULT_DURATION_MINUTES;
    const capacity = input.capacity ?? wh.maxJobsPerSlot ?? Slots.DEFAULT_CAPACITY;
    const days = input.workingDays ?? wh.workingDays;
    if (end <= start) throw new ValidationError(ErrorMessages.VALIDATION_FAILED, { endTime: 'End must be after start' });

    const from = parseDateOnly(input.fromDate);
    const to = parseDateOnly(input.toDate);
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (spanDays > Slots.MAX_GENERATE_DAYS) throw new ValidationError(`Generate at most ${Slots.MAX_GENERATE_DAYS} days at a time`);

    const data: Prisma.AppointmentSlotCreateManyInput[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!days.includes(d.getUTCDay())) continue;
      for (let t = start; t + duration <= end; t += duration) {
        data.push({ branchId: input.branchId, slotDate: d, startTime: minutesToTime(t), endTime: minutesToTime(t + duration), capacity });
      }
    }
    const res = await this.repo.createMany(data);
    await this.settings.audit(actor, AuditActions.CREATE, 'slots', input.branchId, null, { ...input, created: res.count }, meta);
    return { created: res.count, skippedExisting: data.length - res.count };
  }

  async create(actor: AuthUser, input: { branchId: number; slotDate: string; startTime: string; endTime: string; capacity: number }) {
    assertBranchAccess(actor, input.branchId);
    if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) throw new ValidationError(ErrorMessages.VALIDATION_FAILED, { endTime: 'End must be after start' });
    return this.repo.create({ ...input, slotDate: parseDateOnly(input.slotDate) }).catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError(ErrorMessages.ALREADY_EXISTS('Slot'));
      throw e;
    });
  }

  async update(actor: AuthUser, id: number, input: { capacity?: number; isActive?: boolean }) {
    const slot = await this.repo.findById(id);
    if (!slot) throw new NotFoundError('Slot');
    assertBranchAccess(actor, slot.branchId);
    if (input.capacity !== undefined && input.capacity < slot.bookedCount) {
      throw new BusinessRuleError(`Capacity cannot be lower than current bookings (${slot.bookedCount}).`);
    }
    return this.repo.update(id, input);
  }

  async remove(actor: AuthUser, id: number) {
    const slot = await this.repo.findById(id);
    if (!slot) throw new NotFoundError('Slot');
    assertBranchAccess(actor, slot.branchId);
    if (slot.bookedCount > 0) throw new BusinessRuleError('Slot has bookings. Deactivate it instead.');
    await this.repo.delete(id);
  }

  /** Validates and atomically reserves a slot inside the caller's transaction. */
  async reserve(slotId: number, branchId: number, date: Date, bookingId: number, db: Db) {
    const slot = await this.repo.findById(slotId, db);
    if (!slot || slot.branchId !== branchId || toDateOnlyString(slot.slotDate) !== toDateOnlyString(date)) {
      throw new BusinessRuleError(ErrorMessages.SLOT_UNAVAILABLE);
    }
    if (!(await this.repo.reserve(slotId, db))) throw new ConflictError(ErrorMessages.SLOT_FULL, ErrorCodes.SLOT_FULL);
    await this.repo.createSlotBooking(slotId, bookingId, db);
    return slot;
  }

  async release(slotId: number | null, bookingId: number, db: Db) {
    if (!slotId) return;
    await this.repo.release(slotId, db);
    await this.repo.deleteSlotBooking(bookingId, db);
  }
}
