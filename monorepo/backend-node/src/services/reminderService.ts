/**
 * Service reminders (default 6-month interval, service- and customer-specific overrides),
 * status bucketing and scheduled notifications with duplicate prevention.
 */

import { Prisma } from '@prisma/client';
import { NotificationEvents, Reminders } from '../constants';
import { EngagementRepository } from '../repositories/engagementRepository';
import { BookingRepository } from '../repositories/bookingRepository';
import { Db, prisma } from '../repositories/db';
import type { AuthUser } from '../models';
import { NotFoundError } from '../utils/errors';
import { addDays, addMonths, formatDisplayDate, parseDateOnly, todayDateOnly, toDateOnlyString, toPageMeta, toPageParams } from '../utils/helpers';
import { customerBranchWhere, resolveBranchScope } from './accessControl';
import { NotificationService } from './notificationService';
import { SettingsService } from './settingsService';

export class ReminderService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly bookings: BookingRepository,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
  ) {}

  /** Creates reminders for reminder-eligible services on a completed booking. */
  async scheduleForCompletedBooking(bookingId: number, db: Db = prisma): Promise<void> {
    const cfg = await this.settings.reminder(db);
    if (!cfg.enabled) return;
    const booking = await this.bookings.findForReminders(bookingId, db);
    if (!booking) return;
    const eligible = booking.items.filter((i) => i.service.reminderEligible);
    if (!eligible.length) return;
    const serviceIds = eligible.map((i) => i.serviceId);
    await this.repo.completeOpenReminders(booking.customerId, serviceIds, db);
    const base = booking.completedAt ?? new Date();
    for (const item of eligible) {
      const months = booking.customer.reminderIntervalMonths ?? item.service.reminderIntervalMonths ?? cfg.defaultIntervalMonths ?? Reminders.DEFAULT_INTERVAL_MONTHS;
      await this.repo.upsertBookingReminder(
        {
          customerId: booking.customerId,
          serviceId: item.serviceId,
          bookingId: booking.id,
          amcContractId: null,
          type: 'SERVICE',
          dueDate: parseDateOnly(toDateOnlyString(addMonths(base, months))),
          status: 'UPCOMING',
        },
        db,
      );
    }
  }

  private bucketWhere(bucket: string): Prisma.ServiceReminderWhereInput {
    const today = todayDateOnly();
    switch (bucket) {
      case 'upcoming':
        return { status: { in: ['UPCOMING', 'DUE'] }, dueDate: { gt: today } };
      case 'dueToday':
        return { status: { in: ['UPCOMING', 'DUE'] }, dueDate: today };
      case 'overdue':
        return { status: { in: ['UPCOMING', 'DUE', 'OVERDUE'] }, dueDate: { lt: today } };
      case 'completed':
        return { status: { in: ['COMPLETED', 'DISMISSED'] } };
      default:
        return {};
    }
  }

  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; branchId?: number; bucket: string; type?: 'SERVICE' | 'AMC'; customerId?: number }) {
    const branchId = actor.userType === 'CUSTOMER' ? undefined : resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.ServiceReminderWhereInput = {
      ...this.bucketWhere(q.bucket),
      ...(q.type ? { type: q.type } : {}),
      ...(actor.userType === 'CUSTOMER' ? { customerId: actor.customerId ?? -1 } : q.customerId ? { customerId: q.customerId } : {}),
      customer: {
        ...customerBranchWhere(branchId),
        ...(q.search ? { OR: [{ fullName: { contains: q.search } }, { mobile: { contains: q.search } }] } : {}),
      },
    };
    const { items, total } = await this.repo.listReminders(where, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async summary(actor: AuthUser, branchId?: number) {
    const scoped = resolveBranchScope(actor, branchId);
    const customer = scoped ? { customer: customerBranchWhere(scoped) } : {};
    const [upcoming, dueToday, overdue, completed] = await Promise.all(
      ['upcoming', 'dueToday', 'overdue', 'completed'].map((b) =>
        this.repo.listReminders({ ...this.bucketWhere(b), ...customer }, 0, 0).then((r) => r.total),
      ),
    );
    return { upcoming, dueToday, overdue, completed };
  }

  create(input: { customerId: number; serviceId?: number | null; dueDate: string; note?: string | null }) {
    return this.repo.createReminder({
      customerId: input.customerId,
      serviceId: input.serviceId ?? null,
      dueDate: parseDateOnly(input.dueDate),
      note: input.note ?? null,
      type: 'SERVICE',
    });
  }

  async update(id: number, input: { status?: 'UPCOMING' | 'DUE' | 'OVERDUE' | 'COMPLETED' | 'DISMISSED'; dueDate?: string; note?: string | null }) {
    const r = await this.repo.findReminder(id);
    if (!r) throw new NotFoundError('Reminder');
    return this.repo.updateReminder(id, {
      ...(input.status ? { status: input.status } : {}),
      ...(input.dueDate ? { dueDate: parseDateOnly(input.dueDate), status: 'UPCOMING', notifyCount: 0 } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
  }

  /** Job: move statuses forward based on today's date. */
  async refreshStatuses(): Promise<void> {
    const today = todayDateOnly();
    await this.repo.bulkSetReminderStatus({ status: { in: ['UPCOMING', 'DUE'] }, dueDate: { lt: today } }, 'OVERDUE');
    await this.repo.bulkSetReminderStatus({ status: 'UPCOMING', dueDate: today }, 'DUE');
  }

  /** Job: notify customers about upcoming/overdue service (dedupe per reminder per notify round). */
  async sendDueNotifications(): Promise<number> {
    const cfg = await this.settings.reminder();
    if (!cfg.enabled) return 0;
    const today = todayDateOnly();
    const horizon = addDays(today, cfg.daysBeforeDue);
    const renotifyBefore = addDays(new Date(), -Reminders.RENOTIFY_AFTER_DAYS);
    const due = await this.repo.findRemindersToNotify(
      {
        status: { in: ['UPCOMING', 'DUE', 'OVERDUE'] },
        dueDate: { lte: horizon },
        notifyCount: { lt: Reminders.MAX_NOTIFY_COUNT },
        OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: renotifyBefore } }],
      },
      200,
    );
    for (const r of due) {
      await this.notifications.notify({
        userId: r.customer.userId,
        event: r.type === 'AMC' ? NotificationEvents.AMC_EXPIRING : NotificationEvents.SERVICE_DUE,
        data: { serviceName: r.service?.name ?? 'AC service', date: formatDisplayDate(r.dueDate), amcNumber: '' },
        dedupeKey: `reminder:${r.id}:${r.notifyCount + 1}`,
      });
      await this.repo.updateReminder(r.id, { lastNotifiedAt: new Date(), notifyCount: { increment: 1 } });
    }
    return due.length;
  }
}
