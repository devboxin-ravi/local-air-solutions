/**
 * Schemas for invoices, payments, ledger, AMC, reminders, reports and settings.
 */

import { z } from 'zod';
import { INTEGRATION_NAMES, Razorpay as RazorpayConst, type IntegrationName } from '../constants/integrations';
import { Limits, Patterns, ValidationMessages } from '../constants';
import { AppContentLimits as AL, PaymentPolicies, PROMO_ACTIONS, PROMO_STYLES, SettingKeys, TRACKER_REQUIRED_STEPS, TRACKER_STEP_STATUSES, TrackerLimits, type SettingKey } from '../constants/settings';
import { boolish, dateOnly, email, gstRate, hhmm, id, listQuery, mobile, money, notes, optionalTrimmed, trimmed } from './common';

// ─── Invoices ───
export const invoiceLineSchema = z.object({
  serviceId: id.optional().nullable(),
  stockItemId: id.optional().nullable(),
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
/** Admin-entered Razorpay keys. Secrets are optional on update (blank keeps the saved one). */
export const razorpayCredentialsSchema = z.object({
  keyId: z.string().trim().regex(RazorpayConst.KEY_ID_PATTERN, 'Key ID looks like rzp_test_… or rzp_live_…'),
  keySecret: z.string().trim().min(8).max(200).optional().or(z.literal('').transform(() => undefined)),
  webhookSecret: z.string().trim().min(6).max(200).optional().or(z.literal('').transform(() => undefined)),
});
export const razorpayTestSchema = z.object({
  keyId: z.string().trim().regex(RazorpayConst.KEY_ID_PATTERN, 'Key ID looks like rzp_test_… or rzp_live_…').optional(),
  keySecret: z.string().trim().max(200).optional(),
});

/** Admin-entered integration credentials. Secrets may be blank on update (keeps the saved one). */
const optSecret = (max: number) => z.string().max(max).optional().or(z.literal('').transform(() => undefined));
export const integrationNameParams = z.object({ name: z.enum(INTEGRATION_NAMES as [IntegrationName, ...IntegrationName[]]) });
export const integrationCredentialSchemas = {
  smtp: z.object({
    host: z.string().trim().min(3).max(200),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.boolean().default(false),
    user: z.string().trim().min(1).max(200),
    password: optSecret(500),
    from: z.string().trim().min(3).max(200),
  }),
  fcm: z.object({
    projectId: z.string().trim().min(3).max(100),
    clientEmail: z.string().trim().email().max(254),
    privateKey: optSecret(5000),
  }),
  whatsappCloud: z.object({
    phoneNumberId: z.string().trim().regex(/^\d{6,20}$/, 'Phone number ID is digits only'),
    accessToken: optSecret(2000),
  }),
} as const;
/** Test accepts partial input: blanks are filled from what is saved. */
export const integrationTestSchema = z.record(z.unknown()).refine((v) => JSON.stringify(v).length < 10000, 'Payload too large');

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

/*
 * Per-section rules. Every field is optional (a save may send part of a section; it is merged
 * with the stored value), but whatever is sent must be valid. Unknown keys are dropped.
 */
const text = (max: number) => z.string().trim().max(max).optional();
const blankOr = <T extends z.ZodTypeAny>(schema: T) => z.union([z.literal(''), schema]).optional();
const intIn = (min: number, max: number) => z.coerce.number().int().min(min).max(max).optional();
const flag = z.boolean().optional();
const timeOfDay = hhmm.optional();

export const settingValueSchemas: Record<SettingKey, z.ZodTypeAny> = {
  company: z.object({
    name: trimmed(Limits.NAME_MIN, Limits.NAME_MAX).optional(),
    legalName: text(150),
    tagline: text(150),
    email: blankOr(email),
    phone: blankOr(mobile),
    website: blankOr(z.string().trim().url().max(200)),
    address: text(Limits.ADDRESS_MAX),
    gstin: blankOr(z.string().trim().toUpperCase().regex(Patterns.GSTIN, ValidationMessages.GSTIN)),
    stateCode: blankOr(z.string().trim().regex(Patterns.GST_STATE_CODE, ValidationMessages.GST_STATE_CODE)),
    logoUrl: text(500),
    supportPhone: blankOr(mobile),
    supportWhatsapp: blankOr(mobile),
  }),
  general: z.object({
    timezone: trimmed(3, 64).optional(),
    currency: z.string().trim().length(3).optional(),
    dateFormat: text(30),
    allowCustomerCancellationHours: intIn(0, 168),
    requireCompletionOtp: flag,
    technicianCanReject: flag,
    showTechnicianPhoneToCustomer: flag,
  }),
  gst: z.object({
    enabled: flag,
    defaultRate: z.coerce.number().refine((v) => [0, 5, 12, 18, 28].includes(v), ValidationMessages.GST_RATE).optional(),
    pricesIncludeGst: flag,
    sacCode: blankOr(z.string().trim().regex(Patterns.SAC_CODE, ValidationMessages.SAC_CODE)),
  }),
  payment: z
    .object({
      policy: z.enum(Object.values(PaymentPolicies) as [string, ...string[]]).optional(),
      upiEnabled: flag,
      upiId: blankOr(z.string().trim().regex(Patterns.UPI_ID, ValidationMessages.UPI_ID)),
      upiPayeeName: text(100),
      razorpayEnabled: flag,
      cashEnabled: flag,
    })
    .superRefine((v, ctx) => {
      if (v.upiEnabled === true && v.upiId === '') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['upiId'], message: 'UPI ID is required while UPI is enabled' });
      if (v.upiEnabled === false && v.cashEnabled === false && v.razorpayEnabled === false) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cashEnabled'], message: 'Enable at least one payment method' });
      }
    }),
  reminder: z.object({ enabled: flag, defaultIntervalMonths: intIn(1, 36), daysBeforeDue: intIn(0, 60), amcExpiryNoticeDays: intIn(0, 180) }),
  notification: z.object({ inApp: flag, push: flag, email: flag, whatsapp: flag }),
  whatsapp: z.object({ manualSharingEnabled: flag, cloudApiEnabled: flag, businessNumber: blankOr(mobile) }),
  email: z.object({ sendBookingUpdates: flag, sendInvoices: flag, sendReminders: flag }),
  appHome: z.object({
    announcement: text(AL.ANNOUNCEMENT_MAX),
    slides: z
      .array(
        z.object({
          enabled: z.boolean(),
          tag: z.string().trim().max(AL.TAG_MAX),
          title: z.string().trim().min(1, 'Required').max(AL.TITLE_MAX),
          subtitle: z.string().trim().max(AL.SUBTITLE_MAX),
          buttonText: z.string().trim().min(1, 'Required').max(AL.BUTTON_MAX),
          action: z.enum(PROMO_ACTIONS),
          style: z.enum(PROMO_STYLES),
        }),
      )
      .max(AL.MAX_SLIDES)
      .optional(),
    trustPoints: z.array(z.string().trim().min(1, 'Required').max(AL.TRUST_MAX)).length(AL.TRUST_POINTS).optional(),
    todayCard: z
      .object({
        enabled: z.boolean(),
        title: z.string().trim().min(1, 'Required').max(AL.TITLE_MAX),
        subtitle: z.string().trim().max(AL.SUBTITLE_MAX),
        buttonText: z.string().trim().min(1, 'Required').max(AL.BUTTON_MAX),
      })
      .optional(),
    showCategories: flag,
    showPopular: flag,
    showTrustPoints: flag,
    onboarding: z
      .array(z.object({ title: z.string().trim().min(1, 'Required').max(AL.ONBOARDING_TITLE_MAX), text: z.string().trim().max(AL.ONBOARDING_TEXT_MAX) }))
      .length(AL.ONBOARDING_PAGES)
      .optional(),
  }),
  bookingTracker: z.object({
    steps: z
      .array(
        z.object({
          status: z.enum(TRACKER_STEP_STATUSES),
          visible: z.boolean(),
          label: z.string().trim().min(1, 'Required').max(TrackerLimits.LABEL_MAX),
          title: z.string().trim().min(1, 'Required').max(TrackerLimits.TITLE_MAX),
          hint: z.string().trim().max(TrackerLimits.HINT_MAX),
        }),
      )
      .length(TRACKER_STEP_STATUSES.length)
      .refine((steps) => TRACKER_STEP_STATUSES.every((s, i) => steps[i]?.status === s), 'Steps must be in booking order')
      .transform((steps) => steps.map((s) => (TRACKER_REQUIRED_STEPS.includes(s.status) ? { ...s, visible: true } : s)))
      .optional(),
  }),
  workingHours: z
    .object({
      workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
      startTime: timeOfDay,
      endTime: timeOfDay,
      slotDurationMinutes: intIn(30, 480),
      maxJobsPerSlot: intIn(1, 100),
    })
    .refine((v) => !v.startTime || !v.endTime || v.endTime > v.startTime, { message: ValidationMessages.END_AFTER_START, path: ['endTime'] }),
};
export const templateUpdateSchema = z.object({ subject: optionalTrimmed(200), body: trimmed(1, 5000).optional(), isActive: z.boolean().optional() });
export const auditListQuery = listQuery.extend({
  entityType: z.string().max(50).optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  action: z.string().max(50).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});
/** `code` is optional: when omitted it is generated from `name` (StaffService.createRole). */
export const roleSchema = z.object({ code: trimmed(2, 50).toUpperCase().regex(/^[A-Z_]+$/).optional(), name: trimmed(2, 100), description: optionalTrimmed(500), permissionCodes: z.array(z.string().max(100)).max(500).default([]) });
export const roleUpdateSchema = z.object({ name: trimmed(2, 100).optional(), description: optionalTrimmed(500), permissionCodes: z.array(z.string().max(100)).max(500).optional() });
export const notificationReadSchema = z.object({ ids: z.union([z.array(id).max(500), z.literal('all')]) });
export const shareQuery = z.object({ type: z.enum(['booking', 'assignment', 'invoice', 'paymentReminder', 'serviceReminder']), id });
