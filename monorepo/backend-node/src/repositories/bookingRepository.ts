/**
 * Bookings, booking items, status history, assignments, job notes and attachments.
 */

import { AssignmentStatus, BookingStatus, Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export const bookingListInclude = {
  customer: { select: { id: true, fullName: true, mobile: true, countryCode: true, customerCode: true } },
  branch: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  slot: { select: { id: true, startTime: true, endTime: true } },
  items: { select: { id: true, serviceName: true, quantity: true, unitPrice: true, lineTotal: true } },
  assignments: {
    where: { isCurrent: true },
    select: { id: true, status: true, staff: { select: { id: true, staffCode: true, user: { select: { name: true, mobile: true } } } } },
  },
} satisfies Prisma.ServiceBookingInclude;

export const bookingDetailInclude = {
  ...bookingListInclude,
  customer: {
    select: { id: true, fullName: true, mobile: true, countryCode: true, email: true, customerCode: true, alternateMobile: true, userId: true },
  },
  address: { include: { city: { select: { name: true } }, state: { select: { name: true } }, serviceArea: { select: { id: true, name: true } } } },
  items: { include: { service: { select: { id: true, imageUrl: true, durationMinutes: true } } } },
  statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true } } } },
  assignments: {
    orderBy: { assignedAt: 'desc' },
    include: { staff: { select: { id: true, staffCode: true, userId: true, user: { select: { name: true, mobile: true, countryCode: true } } } } },
  },
  notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true } } } },
  attachments: { orderBy: { createdAt: 'asc' } },
  invoices: { where: { status: { not: 'CANCELLED' } }, select: { id: true, invoiceNumber: true, grandTotal: true, status: true, balanceDue: true } },
  payments: { orderBy: { createdAt: 'desc' }, select: { id: true, paymentNumber: true, amount: true, method: true, status: true, referenceNumber: true, createdAt: true } },
  amcVisit: { select: { id: true, visitNumber: true, amcContract: { select: { id: true, amcNumber: true } } } },
} satisfies Prisma.ServiceBookingInclude;

export type BookingDetail = Prisma.ServiceBookingGetPayload<{ include: typeof bookingDetailInclude }>;

export class BookingRepository {
  async list(where: Prisma.ServiceBookingWhereInput, orderBy: Prisma.ServiceBookingOrderByWithRelationInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.serviceBooking.findMany({ where, orderBy, skip, take, include: bookingListInclude }),
      db.serviceBooking.count({ where }),
    ]);
    return { items, total };
  }

  findForCalendar(where: Prisma.ServiceBookingWhereInput, db: Db = prisma) {
    return db.serviceBooking.findMany({ where, include: bookingListInclude, orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }], take: 1000 });
  }

  findById(id: number, db: Db = prisma) {
    return db.serviceBooking.findUnique({ where: { id }, include: bookingDetailInclude });
  }

  findPlain(id: number, db: Db = prisma) {
    return db.serviceBooking.findUnique({ where: { id }, include: { items: true } });
  }

  /** Locks the booking row for the remainder of the transaction (status changes are serialized). */
  async lockById(id: number, db: Db) {
    await db.$queryRaw`SELECT id FROM service_bookings WHERE id = ${id} FOR UPDATE`;
    return db.serviceBooking.findUnique({ where: { id }, include: { items: true } });
  }

  create(data: Prisma.ServiceBookingUncheckedCreateInput, db: Db = prisma) {
    return db.serviceBooking.create({ data });
  }

  update(id: number, data: Prisma.ServiceBookingUncheckedUpdateInput, db: Db = prisma) {
    return db.serviceBooking.update({ where: { id }, data });
  }

  createItems(data: Prisma.BookingItemCreateManyInput[], db: Db = prisma) {
    return db.bookingItem.createMany({ data });
  }

  markItemsPerformed(bookingId: number, itemIds: number[], db: Db = prisma) {
    return Promise.all([
      db.bookingItem.updateMany({ where: { bookingId }, data: { isPerformed: false } }),
      db.bookingItem.updateMany({ where: { bookingId, id: { in: itemIds } }, data: { isPerformed: true } }),
    ]);
  }

  addStatusHistory(data: Prisma.BookingStatusHistoryUncheckedCreateInput, db: Db = prisma) {
    return db.bookingStatusHistory.create({ data });
  }

  countByStatus(where: Prisma.ServiceBookingWhereInput, db: Db = prisma) {
    return db.serviceBooking.groupBy({ by: ['status'], where, _count: { _all: true } });
  }

  // ─── Assignments ───
  findCurrentAssignment(bookingId: number, db: Db = prisma) {
    return db.technicianAssignment.findFirst({ where: { bookingId, isCurrent: true }, include: { staff: { include: { user: true } } } });
  }

  closeCurrentAssignments(bookingId: number, status: AssignmentStatus, db: Db = prisma) {
    return db.technicianAssignment.updateMany({
      where: { bookingId, isCurrent: true },
      data: { isCurrent: false, status, respondedAt: new Date() },
    });
  }

  createAssignment(data: Prisma.TechnicianAssignmentUncheckedCreateInput, db: Db = prisma) {
    return db.technicianAssignment.create({ data });
  }

  updateAssignment(id: number, data: Prisma.TechnicianAssignmentUncheckedUpdateInput, db: Db = prisma) {
    return db.technicianAssignment.update({ where: { id }, data });
  }

  async listAssignments(where: Prisma.TechnicianAssignmentWhereInput, skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.technicianAssignment.findMany({
        where,
        skip,
        take,
        orderBy: { assignedAt: 'desc' },
        include: {
          staff: { select: { id: true, staffCode: true, user: { select: { name: true, mobile: true } } } },
          booking: { include: bookingListInclude },
        },
      }),
      db.technicianAssignment.count({ where }),
    ]);
    return { items, total };
  }

  /** Technician's jobs (current assignments) filtered by booking statuses/date range. */
  findTechnicianJobs(staffId: number, bookingWhere: Prisma.ServiceBookingWhereInput, db: Db = prisma) {
    return db.serviceBooking.findMany({
      where: { ...bookingWhere, assignments: { some: { staffId, isCurrent: true, status: { not: 'REJECTED' } } } },
      include: {
        ...bookingListInclude,
        address: { include: { city: { select: { name: true } }, serviceArea: { select: { name: true } } } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
      take: 200,
    });
  }

  countTechnicianJobs(staffId: number, statuses: BookingStatus[], date?: Date, db: Db = prisma) {
    return db.serviceBooking.count({
      where: {
        status: { in: statuses },
        ...(date ? { scheduledDate: date } : {}),
        assignments: { some: { staffId, isCurrent: true } },
      },
    });
  }

  // ─── Notes & attachments ───
  addNote(data: Prisma.JobNoteUncheckedCreateInput, db: Db = prisma) {
    return db.jobNote.create({ data, include: { author: { select: { id: true, name: true } } } });
  }

  addAttachments(data: Prisma.JobAttachmentCreateManyInput[], db: Db = prisma) {
    return db.jobAttachment.createMany({ data });
  }

  listAttachments(bookingId: number, db: Db = prisma) {
    return db.jobAttachment.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });
  }

  replaceItems(bookingId: number, data: Prisma.BookingItemCreateManyInput[], db: Db = prisma) {
    return db.bookingItem.deleteMany({ where: { bookingId } }).then(() => db.bookingItem.createMany({ data }));
  }

  /** Marks a booking as covered under AMC (zero value, linked to the visit). */
  async linkToAmcVisit(bookingId: number, amcVisitId: number, db: Db = prisma) {
    await db.serviceBooking.update({ where: { id: bookingId }, data: { amcVisitId, source: 'AMC', estimatedTotal: 0, status: 'CONFIRMED', paymentStatus: 'PAID' } });
    await db.bookingItem.updateMany({ where: { bookingId }, data: { unitPrice: 0, lineTotal: 0 } });
  }

  completeAmcVisit(amcVisitId: number, db: Db = prisma) {
    return db.amcVisit.update({ where: { id: amcVisitId }, data: { status: 'COMPLETED', completedAt: new Date() } });
  }

  findForReminders(id: number, db: Db = prisma) {
    return db.serviceBooking.findUnique({ where: { id }, include: { customer: true, items: { include: { service: true } } } });
  }
}
