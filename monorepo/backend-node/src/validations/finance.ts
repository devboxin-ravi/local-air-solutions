/**
 * Schemas for invoices, payments, ledger, AMC, reminders, reports and settings.
 */

import { z } from 'zod';
import { Limits } from '../constants';
import { SettingKeys } from '../constants/settings';
import { boolish, dateOnly, gstRate, id, listQuery, money, notes, optionalTrimmed, trimmed } from './common';

// ─── Invoices ───
export const invoiceLineSchema = z.object({
  serviceId: id.optional().nullable(),
  description: trimmed(2, 500),
  quantity: z.coerce.number().int().min(1).max(1000),
  rate: money,
  discount: money.default(0),
  gstRate: gstRate.default(0),
});

export const invoiceFromBookingSchema = z.object({
  bookingId: id,
  applyGst: z.boolean().default(true),
  isInterState: z.boolean().default(false),
  discount: money.default(0),
  isFreeService: z.boolean().default(false),
  lines: z.array(invoiceLineSchema).max(50).optional(),
  notes,
});

export const invoiceManualSchema = z.object({
  customerId: id,
  branchId: id,
  applyGst: z.boolean().default(true),
  isInterState: z.boolean().default(false),
  discount: money.default(0),
  isFreeService: z.boolean().default(false),
  lines: z.array(invoiceLineSchema).min(1).max(50),
  notes,
});

export const invoiceListQuery = listQuery.extend({
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  isFreeService: boolish.optional(),
  outstandingOnly: boolish.optional(),
});

export const invoiceCancelSchema = z.object({ reason: trimmed(3, Limits.NOTES_MAX) });
export const invoiceShareSchema = z.object({
  invoiceIds: z.array(id).min(1).max(50),
  channel: z.enum(['EMAIL', 'WHATSAPP']),
  /** Optional staff user ids to share with in addition to the customer. */
  staffUserIds: z.array(id).max(20).default([]),
  toCustomer: z.boolean().default(true),
});

// ─── Payments ───
export const paymentCreateSchema = z
  .object({
    customerId: id,
    invoiceId: id.optional().nullable(),
    bookingId: id.optional().nullable(),
    amcContractId: id.optional().nullable(),
    method: z.enum(['UPI_MANUAL', 'CASH', 'BANK_TRANSFER']),
    amount: money.refine((v) => v > 0, 'Amount must be greater than 0'),
    referenceNumber: optionalTrimmed(100),
    receivedAt: dateOnly.optional(),
    note: notes,
  })
  .refine((v) => v.method === 'CASH' || !!v.referenceNumber, { message: 'Reference number is required', path: ['referenceNumber'] });

export const customerUpiSubmitSchema = z.object({
  bookingId: id.optional().nullable(),
  invoiceId: id.optional().nullable(),
  amcContractId: id.optional().nullable(),
  amount: money.refine((v) => v > 0, 'Amount must be greater than 0'),
  referenceNumber: trimmed(4, 100),
});

export const paymentVerifySchema = z.object({ approve: z.boolean(), note: notes });
export const paymentRefundSchema = z.object({ amount: money.refine((v) => v > 0), reason: trimmed(3, Limits.NOTES_MAX) });
export const paymentListQuery = listQuery.extend({
  status: z.enum(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REFUNDED', 'FAILED']).optional(),
  method: z.enum(['RAZORPAY', 'UPI_MANUAL', 'CASH', 'BANK_TRANSFER']).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const razorpayOrderSchema = z.object({ invoiceId: id.optional().nullable(), bookingId: id.optional().nullable(), amcContractId: id.optional().nullable() });
export const razorpayVerifySchema = z.object({
  razorpay_order_id: z.string().max(100),
  razorpay_payment_id: z.string().max(100),
  razorpay_signature: z.string().max(200),
});

// ─── Ledger ───
export const ledgerAdjustmentSchema = z.object({
  customerId: id,
  entryType: z.enum(['ADJUSTMENT', 'OPENING_BALANCE']),
  direction: z.enum(['DEBIT', 'CREDIT']),
  amount: money.refine((v) => v > 0),
  description: trimmed(3, 500),
});
export const ledgerQuery = listQuery.extend({ from: dateOnly.optional(), to: dateOnly.optional() });

// ─── AMC ───
export const amcCreateSchema = z
  .object({
    customerId: id,
    addressId: id,
    branchId: id,
    productDetails: trimmed(2, 1000),
    serviceIds: z.array(id).min(1).max(30),
    startDate: dateOnly,
    endDate: dateOnly,
    totalVisits: z.coerce.number().int().min(1).max(52),
    visitFrequencyMonths: z.coerce.number().int().min(1).max(12),
    contractAmount: money,
    applyGst: z.boolean().default(true),
    terms: optionalTrimmed(10000),
  })
  .refine((v) => v.endDate > v.startDate, { message: 'End date must be after start date', path: ['endDate'] });
export const amcUpdateSchema = z.object({
  productDetails: trimmed(2, 1000).optional(),
  serviceIds: z.array(id).min(1).max(30).optional(),
  terms: optionalTrimmed(10000),
  contractAmount: money.optional(),
  totalVisits: z.coerce.number().int().min(1).max(52).optional(),
  visitFrequencyMonths: z.coerce.number().int().min(1).max(12).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
});
export const amcListQuery = listQuery.extend({
  status: z.enum(['DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED']).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
});
export const amcVisitListQuery = listQuery.extend({
  status: z.enum(['SCHEDULED', 'BOOKED', 'COMPLETED', 'MISSED', 'CANCELLED']).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  amcContractId: z.coerce.number().int().positive().optional(),
});
export const amcVisitBookSchema = z.object({ scheduledDate: dateOnly, slotId: id.optional().nullable(), staffId: id.optional().nullable() });
export const amcCancelSchema = z.object({ reason: trimmed(3, Limits.NOTES_MAX) });

// ─── Reminders ───
export const reminderListQuery = listQuery.extend({
  bucket: z.enum(['upcoming', 'dueToday', 'overdue', 'completed', 'all']).default('all'),
  type: z.enum(['SERVICE', 'AMC']).optional(),
  customerId: z.coerce.number().int().positive().optional(),
});
export const reminderCreateSchema = z.object({
  customerId: id,
  serviceId: id.optional().nullable(),
  dueDate: dateOnly,
  note: notes,
});
export const reminderUpdateSchema = z.object({
  status: z.enum(['UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED', 'DISMISSED']).optional(),
  dueDate: dateOnly.optional(),
  note: notes,
});

// ─── Reports ───
export const reportQuery = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  branchId: z.coerce.number().int().positive().optional(),
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json'),
  granularity: z.enum(['day', 'month']).default('month'),
});
export const globalSearchQuery = z.object({ q: z.string().trim().min(2).max(100), branchId: z.coerce.number().int().positive().optional() });

// ─── Settings ───
export const settingKeyParams = z.object({
  key: z.enum(Object.values(SettingKeys) as [string, ...string[]]),
});
export const settingValueSchema = z.record(z.unknown()).refine((v) => JSON.stringify(v).length < 20000, 'Settings payload too large');
export const templateUpdateSchema = z.object({ subject: optionalTrimmed(200), body: trimmed(1, 5000).optional(), isActive: z.boolean().optional() });
export const auditListQuery = listQuery.extend({
  entityType: z.string().max(50).optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  action: z.string().max(50).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});
export const roleSchema = z.object({ code: trimmed(2, 50).toUpperCase().regex(/^[A-Z_]+$/), name: trimmed(2, 100), description: optionalTrimmed(500), permissionCodes: z.array(z.string().max(100)).max(500).default([]) });
export const roleUpdateSchema = z.object({ name: trimmed(2, 100).optional(), description: optionalTrimmed(500), permissionCodes: z.array(z.string().max(100)).max(500).optional() });
export const notificationReadSchema = z.object({ ids: z.union([z.array(id).max(500), z.literal('all')]) });
export const shareQuery = z.object({ type: z.enum(['booking', 'assignment', 'invoice', 'paymentReminder', 'serviceReminder']), id });
