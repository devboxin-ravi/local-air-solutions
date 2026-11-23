/**
 * Reminders, notifications, templates, settings and audit logs data access.
 */

import { NotificationChannel, Prisma, ReminderStatus } from '@prisma/client';
import { Db, prisma } from './db';

export class EngagementRepository {
  // ─── Reminders ───
  async listReminders(where: Prisma.ServiceReminderWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.serviceReminder.findMany({
        where,
        skip,
        take,
        orderBy: { dueDate: 'asc' },
        include: {
          customer: { select: { id: true, fullName: true, mobile: true, countryCode: true, customerCode: true, userId: true } },
          service: { select: { id: true, name: true } },
          booking: { select: { id: true, bookingNumber: true } },
          amcContract: { select: { id: true, amcNumber: true } },
        },
      }),
      db.serviceReminder.count({ where }),
    ]);
    return { items, total };
  }

  findReminder(id: number, db: Db = prisma) {
    return db.serviceReminder.findUnique({ where: { id }, include: { customer: true, service: true } });
  }

  upsertBookingReminder(data: Prisma.ServiceReminderUncheckedCreateInput & { bookingId: number; serviceId: number }, db: Db = prisma) {
    return db.serviceReminder.upsert({
      where: { bookingId_serviceId: { bookingId: data.bookingId, serviceId: data.serviceId } },
      create: data,
      update: { dueDate: data.dueDate },
    });
  }

  createReminder(data: Prisma.ServiceReminderUncheckedCreateInput, db: Db = prisma) {
    return db.serviceReminder.create({ data });
  }

  updateReminder(id: number, data: Prisma.ServiceReminderUncheckedUpdateInput, db: Db = prisma) {
    return db.serviceReminder.update({ where: { id }, data });
  }

  /** Closes earlier open reminders for the same customer+service when a newer service is done. */
  completeOpenReminders(customerId: number, serviceIds: number[], db: Db = prisma) {
    return db.serviceReminder.updateMany({
      where: { customerId, serviceId: { in: serviceIds }, status: { in: ['UPCOMING', 'DUE', 'OVERDUE'] } },
      data: { status: 'COMPLETED' },
    });
  }

  bulkSetReminderStatus(where: Prisma.ServiceReminderWhereInput, status: ReminderStatus, db: Db = prisma) {
    return db.serviceReminder.updateMany({ where, data: { status } });
  }

  findRemindersToNotify(where: Prisma.ServiceReminderWhereInput, take: number, db: Db = prisma) {
    return db.serviceReminder.findMany({
      where,
      take,
      include: { customer: { select: { id: true, userId: true, fullName: true } }, service: { select: { name: true } } },
    });
  }

  countRemindersByStatus(where: Prisma.ServiceReminderWhereInput, db: Db = prisma) {
    return db.serviceReminder.groupBy({ by: ['status'], where, _count: { _all: true } });
  }

  // ─── Notifications ───
  createNotification(data: Prisma.NotificationUncheckedCreateInput, db: Db = prisma) {
    return db.notification.create({ data });
  }

  findNotificationByDedupe(dedupeKey: string, db: Db = prisma) {
    return db.notification.findUnique({ where: { dedupeKey } });
  }

  async listNotifications(userId: number, channel: NotificationChannel, skip: number, take: number, db: Db = prisma) {
    const where: Prisma.NotificationWhereInput = { userId, channel };
    const [items, total, unread] = await Promise.all([
      db.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      db.notification.count({ where }),
      db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, total, unread };
  }

  markRead(userId: number, ids: number[] | 'all', db: Db = prisma) {
    return db.notification.updateMany({
      where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  pendingDeliveries(maxAttempts: number, take: number, db: Db = prisma) {
    return db.notification.findMany({
      where: { channel: { in: ['PUSH', 'EMAIL', 'WHATSAPP'] }, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: maxAttempts } },
      take,
      orderBy: { id: 'asc' },
      include: { user: { select: { id: true, email: true, mobile: true, countryCode: true, deviceTokens: true } } },
    });
  }

  updateNotification(id: number, data: Prisma.NotificationUncheckedUpdateInput, db: Db = prisma) {
    return db.notification.update({ where: { id }, data });
  }

  // ─── Templates ───
  listTemplates(db: Db = prisma) {
    return db.notificationTemplate.findMany({ orderBy: [{ eventType: 'asc' }, { channel: 'asc' }] });
  }

  findTemplate(eventType: string, channel: NotificationChannel, db: Db = prisma) {
    return db.notificationTemplate.findUnique({ where: { eventType_channel: { eventType, channel } } });
  }

  updateTemplate(id: number, data: Prisma.NotificationTemplateUpdateInput, db: Db = prisma) {
    return db.notificationTemplate.update({ where: { id }, data });
  }

  // ─── Settings ───
  listSettings(db: Db = prisma) {
    return db.companySetting.findMany();
  }

  findSetting(key: string, db: Db = prisma) {
    return db.companySetting.findUnique({ where: { key } });
  }

  upsertSetting(key: string, value: Prisma.InputJsonValue, updatedBy: number | null, db: Db = prisma) {
    return db.companySetting.upsert({ where: { key }, create: { key, value, updatedBy }, update: { value, updatedBy } });
  }

  // ─── Audit ───
  createAudit(data: Prisma.AuditLogUncheckedCreateInput, db: Db = prisma) {
    return db.auditLog.create({ data });
  }

  async listAudit(where: Prisma.AuditLogWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.auditLog.findMany({ where, skip, take, orderBy: { id: 'desc' }, include: { actor: { select: { id: true, name: true } } } }),
      db.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
