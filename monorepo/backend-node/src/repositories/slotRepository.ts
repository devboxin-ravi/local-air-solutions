/**
 * Appointment slots data access with concurrency-safe reservation.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export class SlotRepository {
  list(where: Prisma.AppointmentSlotWhereInput, db: Db = prisma) {
    return db.appointmentSlot.findMany({
      where,
      orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
      include: { branch: { select: { id: true, name: true } } },
      take: 2000,
    });
  }

  findById(id: number, db: Db = prisma) {
    return db.appointmentSlot.findUnique({ where: { id } });
  }

  create(data: Prisma.AppointmentSlotUncheckedCreateInput, db: Db = prisma) {
    return db.appointmentSlot.create({ data });
  }

  createMany(data: Prisma.AppointmentSlotCreateManyInput[], db: Db = prisma) {
    return db.appointmentSlot.createMany({ data, skipDuplicates: true });
  }

  update(id: number, data: Prisma.AppointmentSlotUncheckedUpdateInput, db: Db = prisma) {
    return db.appointmentSlot.update({ where: { id }, data });
  }

  delete(id: number, db: Db = prisma) {
    return db.appointmentSlot.delete({ where: { id } });
  }

  /**
   * Atomically reserves one unit of capacity. Returns true when reserved.
   * The conditional UPDATE is a single statement — two concurrent requests cannot
   * both succeed for the last remaining seat.
   */
  async reserve(slotId: number, db: Db = prisma): Promise<boolean> {
    const affected = await db.$executeRaw`
      UPDATE appointment_slots
         SET booked_count = booked_count + 1
       WHERE id = ${slotId} AND is_active = 1 AND booked_count < capacity`;
    return affected === 1;
  }

  async release(slotId: number, db: Db = prisma): Promise<void> {
    await db.$executeRaw`UPDATE appointment_slots SET booked_count = booked_count - 1 WHERE id = ${slotId} AND booked_count > 0`;
  }

  createSlotBooking(slotId: number, bookingId: number, db: Db = prisma) {
    return db.slotBooking.create({ data: { slotId, bookingId } });
  }

  deleteSlotBooking(bookingId: number, db: Db = prisma) {
    return db.slotBooking.deleteMany({ where: { bookingId } });
  }
}
