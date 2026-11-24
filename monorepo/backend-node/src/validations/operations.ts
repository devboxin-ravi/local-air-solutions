/**
 * Schemas for customers, staff, slots, bookings and assignments.
 */

import { z } from 'zod';
import { Limits } from '../constants';
import { addressInput } from './auth';
import {
  boolish,
  dateOnly,
  description,
  hhmm,
  id,
  listQuery,
  mobile,
  name,
  notes,
  optionalEmail,
  optionalMobile,
  optionalTrimmed,
  optionalUsername,
  password,
} from './common';

// ─── Customers ───
export const customerSchema = z.object({
  fullName: name,
  mobile,
  email: optionalEmail,
  alternateMobile: optionalMobile,
  branchId: id.optional().nullable(),
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  notes,
  reminderIntervalMonths: z.coerce.number().int().min(1).max(36).optional().nullable(),
  address: addressInput.optional(),
  /** Explicitly acknowledge a shared/duplicate phone number. */
  allowDuplicateMobile: z.boolean().default(false),
});
export const customerUpdateSchema = customerSchema.omit({ address: true }).partial();
export const customerListQuery = listQuery.extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).optional(),
  cityId: z.coerce.number().int().positive().optional(),
});
export const addressSchema = addressInput.extend({ isDefault: z.boolean().default(false) });
export const addressUpdateSchema = addressSchema.partial();
export const addressListQuery = listQuery.extend({ cityId: z.coerce.number().int().positive().optional(), pincode: z.string().max(6).optional() });

// ─── Staff ───
export const staffSchema = z.object({
  name,
  mobile,
  email: optionalEmail,
  username: optionalUsername,
  password: password.optional(),
  roleCodes: z.array(z.string().max(50)).min(1).default(['TECHNICIAN']),
  designation: optionalTrimmed(100),
  branchId: id,
  experienceYears: z.coerce.number().int().min(0).max(60).default(0),
  workStartTime: hhmm.default('09:00'),
  workEndTime: hhmm.default('18:00'),
  isTechnician: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  skillIds: z.array(id).max(50).default([]),
  serviceAreaIds: z.array(id).max(100).default([]),
});
export const staffUpdateSchema = staffSchema.partial().extend({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional() });
export const staffListQuery = listQuery.extend({
  isTechnician: boolish.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  skillId: z.coerce.number().int().positive().optional(),
});

// ─── Slots ───
export const slotGenerateSchema = z
  .object({
    branchId: id,
    fromDate: dateOnly,
    toDate: dateOnly,
    startTime: hhmm.optional(),
    endTime: hhmm.optional(),
    slotDurationMinutes: z.coerce.number().int().min(30).max(480).optional(),
    capacity: z.coerce.number().int().min(1).max(100).optional(),
    workingDays: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'toDate must be on/after fromDate', path: ['toDate'] });
export const slotSchema = z.object({ branchId: id, slotDate: dateOnly, startTime: hhmm, endTime: hhmm, capacity: z.coerce.number().int().min(1).max(100) });
export const slotUpdateSchema = z.object({ capacity: z.coerce.number().int().min(0).max(100).optional(), isActive: z.boolean().optional() });
export const slotListQuery = z.object({ branchId: z.coerce.number().int().positive().optional(), from: dateOnly.optional(), to: dateOnly.optional(), availableOnly: boolish.optional() });

// ─── Bookings ───
export const bookingItemInput = z.object({ serviceId: id, quantity: z.coerce.number().int().min(1).max(50).default(1) });
export const bookingCreateSchema = z
  .object({
    bookingType: z.enum(['SERVICE', 'REPAIR']),
    customerId: id.optional(),
    addressId: id,
    branchId: id.optional(),
    productId: id.optional().nullable(),
    items: z.array(bookingItemInput).max(20).default([]),
    scheduledDate: dateOnly,
    slotId: id.optional().nullable(),
    problemCategory: optionalTrimmed(100),
    problemDescription: description,
    instructions: notes,
    paymentMethod: z.enum(['RAZORPAY', 'UPI_MANUAL', 'CASH', 'BANK_TRANSFER']).optional().nullable(),
  })
  .refine((v) => v.bookingType === 'REPAIR' || v.items.length > 0, { message: 'Select at least one service', path: ['items'] })
  .refine((v) => v.bookingType === 'SERVICE' || (v.problemDescription && v.problemDescription.length >= 5), {
    message: 'Describe the problem (min 5 characters)',
    path: ['problemDescription'],
  });
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const bookingStatusEnum = z.enum([
  'PENDING_PAYMENT',
  'PAYMENT_VERIFICATION',
  'CONFIRMED',
  'ASSIGNED',
  'ACCEPTED',
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'RESCHEDULED',
]);

export const bookingListQuery = listQuery.extend({
  status: z.union([bookingStatusEnum, z.string().transform((s) => s.split(','))]).optional(),
  bookingType: z.enum(['SERVICE', 'REPAIR']).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  staffId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  dateField: z.enum(['scheduledDate', 'createdAt']).default('createdAt'),
  unassigned: boolish.optional(),
});
export type BookingListQuery = z.infer<typeof bookingListQuery>;

export const bookingStatusSchema = z.object({ status: bookingStatusEnum, note: notes });
export const bookingCancelSchema = z.object({ reason: z.string().trim().min(3).max(Limits.NOTES_MAX) });
export const bookingRescheduleSchema = z.object({ scheduledDate: dateOnly, slotId: id.optional().nullable(), note: notes });
export const bookingUpdateSchema = z.object({
  instructions: notes,
  problemDescription: description,
  problemCategory: optionalTrimmed(100),
  productId: id.optional().nullable(),
  items: z.array(bookingItemInput).max(20).optional(),
});
export const noteSchema = z.object({ note: z.string().trim().min(1).max(Limits.NOTES_MAX) });
export const calendarQuery = z.object({ branchId: z.coerce.number().int().positive().optional(), from: dateOnly, to: dateOnly });

// ─── Assignments ───
export const assignSchema = z.object({ staffId: id, notes });
export const assignmentListQuery = listQuery.extend({
  status: z.enum(['ASSIGNED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED']).optional(),
  staffId: z.coerce.number().int().positive().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  currentOnly: boolish.optional(),
});
export const availabilityQuery = z.object({ branchId: z.coerce.number().int().positive().optional(), date: dateOnly });

// ─── Technician app ───
export const techJobsQuery = z.object({ scope: z.enum(['today', 'upcoming', 'history', 'active']).default('today') });
export const techRespondSchema = z.object({ accept: z.boolean(), reason: optionalTrimmed(Limits.NOTES_MAX) });
export const techStatusSchema = z.object({ status: z.enum(['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS']), note: notes });
export const techCompleteSchema = z.object({
  performedItemIds: z.array(id).max(50).default([]),
  note: notes,
  completionOtp: z.string().trim().regex(/^\d{6}$/).optional(),
});
export const attachmentKindSchema = z.object({ kind: z.enum(['BEFORE', 'AFTER', 'OTHER']).default('OTHER') });
