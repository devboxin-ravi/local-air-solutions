/**
 * Client-side Zod form schemas (mirrors backend validation; the server re-validates everything).
 * Strings are trimmed; Unicode names and real-world address punctuation are allowed.
 */

import { z } from 'zod';
import { APP_CONTENT, LIMITS, MESSAGES, PATTERNS, TRACKER } from '@/constants/ui';

/**
 * Friendly default messages for every schema in the app (instead of Zod's technical wording).
 * Explicit messages passed to a rule still win.
 */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: MESSAGES.REQUIRED };
      if (issue.expected === 'number' || issue.received === 'nan') return { message: MESSAGES.NUMBER };
      if (issue.expected === 'integer') return { message: MESSAGES.WHOLE_NUMBER };
      break;
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: Number(issue.minimum) <= 1 ? MESSAGES.REQUIRED : `Must be at least ${issue.minimum} characters` };
      if (issue.type === 'number') return { message: issue.inclusive ? `Must be at least ${issue.minimum}` : `Must be more than ${issue.minimum}` };
      if (issue.type === 'array') return { message: Number(issue.minimum) <= 1 ? MESSAGES.SELECT_ONE : `Select at least ${issue.minimum}` };
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Maximum ${issue.maximum} characters` };
      if (issue.type === 'number') return { message: `Must be at most ${issue.maximum}` };
      break;
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Enter a valid email' };
      if (issue.validation === 'url') return { message: MESSAGES.URL };
      break;
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Select a valid option' };
    case z.ZodIssueCode.not_multiple_of:
      return { message: 'Use at most 2 decimal places' };
    default:
      break;
  }
  return { message: ctx.defaultError };
});

const t = (min: number, max: number, label = 'This field') =>
  z.string().trim().min(min, min === 1 ? MESSAGES.REQUIRED : `${label} must be at least ${min} characters`).max(max, `Maximum ${max} characters`);
/** Required trimmed text with a max length. */
const req = (max: number) => z.string().trim().min(1, 'Required').max(max, `Maximum ${max} characters`);
const opt = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`).optional().or(z.literal(''));

export const nameField = t(LIMITS.NAME_MIN, LIMITS.NAME_MAX, 'Name');
export const mobileField = z.string().trim().regex(PATTERNS.MOBILE, MESSAGES.MOBILE);
export const optionalMobile = z.string().trim().regex(PATTERNS.MOBILE, MESSAGES.MOBILE).optional().or(z.literal(''));
export const emailField = z.string().trim().toLowerCase().email('Enter a valid email').max(LIMITS.EMAIL_MAX);
export const optionalEmail = emailField.optional().or(z.literal(''));
export const usernameField = z.string().trim().toLowerCase().regex(PATTERNS.USERNAME, MESSAGES.USERNAME);
export const optionalUsername = usernameField.optional().or(z.literal(''));
export const pincodeField = z.string().trim().regex(PATTERNS.PINCODE, MESSAGES.PINCODE);
export const passwordField = z.string().min(LIMITS.PASSWORD_MIN, MESSAGES.PASSWORD).max(128).regex(PATTERNS.PASSWORD, MESSAGES.PASSWORD);
export const notesField = opt(LIMITS.NOTES_MAX);
export const descriptionField = opt(LIMITS.DESCRIPTION_MAX);
export const idField = z.coerce.number({ invalid_type_error: MESSAGES.REQUIRED }).int().positive(MESSAGES.REQUIRED);
export const moneyField = z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(0, 'Cannot be negative').max(99_999_999.99);
export const timeField = z.string().regex(PATTERNS.TIME, 'Use HH:mm');
export const dateField = z.string().min(1, MESSAGES.REQUIRED);

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile'),
  password: z.string().min(1, 'Enter your password'),
});

export const addressSchema = z.object({
  label: t(1, 50),
  line1: t(LIMITS.ADDRESS_MIN, LIMITS.ADDRESS_MAX, 'Address'),
  line2: opt(LIMITS.ADDRESS_MAX),
  landmark: opt(200),
  stateId: idField,
  cityId: idField,
  pincode: pincodeField,
  latitude: z.union([z.coerce.number().min(-90).max(90), z.literal('')]).optional(),
  longitude: z.union([z.coerce.number().min(-180).max(180), z.literal('')]).optional(),
  isDefault: z.boolean().optional(),
});
export type AddressForm = z.infer<typeof addressSchema>;

export const customerSchema = z.object({
  fullName: nameField,
  mobile: mobileField,
  email: optionalEmail,
  alternateMobile: optionalMobile,
  branchId: z.union([idField, z.literal('')]).optional(),
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  notes: notesField,
  reminderIntervalMonths: z.union([z.coerce.number().int().min(1).max(36), z.literal('')]).optional(),
});
export type CustomerForm = z.infer<typeof customerSchema>;

export const serviceSchema = z
  .object({
    categoryId: idField,
    code: z.string().trim().toUpperCase().min(2).max(30).regex(PATTERNS.SERVICE_CODE, 'Uppercase letters, numbers and hyphens only'),
    name: nameField,
    description: descriptionField,
    imageUrl: opt(500),
    durationMinutes: z.coerce.number().int().min(10, 'Min 10 minutes').max(1440),
    pricingType: z.enum(['FIXED', 'STARTING', 'QUOTATION', 'FREE']),
    basePrice: moneyField,
    gstApplicable: z.boolean(),
    gstRate: z.coerce.number().min(0).max(28),
    reminderEligible: z.boolean(),
    reminderIntervalMonths: z.union([z.coerce.number().int().min(1).max(36), z.literal('')]).optional(),
    isPopular: z.boolean(),
    isActive: z.boolean(),
    skillIds: z.array(z.number()),
    branchIds: z.array(z.number()),
  })
  .refine((v) => v.pricingType === 'FREE' || v.pricingType === 'QUOTATION' || v.basePrice > 0, { message: 'Enter a price for fixed / starting price services', path: ['basePrice'] });
export type ServiceForm = z.infer<typeof serviceSchema>;

export const staffSchema = z.object({
  name: nameField,
  mobile: mobileField,
  email: optionalEmail,
  username: optionalUsername,
  password: z.union([passwordField, z.literal('')]).optional(),
  roleCodes: z.array(z.string()).min(1, 'Select at least one role'),
  designation: opt(100),
  branchId: idField,
  experienceYears: z.coerce.number().int().min(0).max(60),
  workStartTime: timeField,
  workEndTime: timeField,
  isTechnician: z.boolean(),
  isAvailable: z.boolean(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  skillIds: z.array(z.number()),
  serviceAreaIds: z.array(z.number()),
}).refine((v) => v.workEndTime > v.workStartTime, { message: 'Shift must end after it starts', path: ['workEndTime'] });
export type StaffForm = z.infer<typeof staffSchema>;

export const amcSchema = z
  .object({
    customerId: idField,
    addressId: idField,
    branchId: idField,
    productDetails: t(2, 1000, 'Product details'),
    serviceIds: z.array(z.number()).min(1, 'Select at least one covered service'),
    startDate: dateField,
    endDate: dateField,
    totalVisits: z.coerce.number().int().min(1).max(52),
    visitFrequencyMonths: z.coerce.number().int().min(1).max(12),
    contractAmount: moneyField,
    applyGst: z.boolean(),
    terms: opt(10000),
  })
  .refine((v) => v.endDate > v.startDate, { message: 'End date must be after start date', path: ['endDate'] });
export type AmcForm = z.infer<typeof amcSchema>;

export const paymentSchema = z
  .object({
    method: z.enum(['UPI_MANUAL', 'CASH', 'BANK_TRANSFER']),
    amount: moneyField.refine((v) => v > 0, 'Amount must be greater than 0'),
    referenceNumber: opt(100),
    receivedAt: z.string().optional(),
    note: notesField,
  })
  .refine((v) => v.method === 'CASH' || !!v.referenceNumber, { message: 'Reference number is required', path: ['referenceNumber'] });
export type PaymentForm = z.infer<typeof paymentSchema>;

// ─── Shared building blocks for the forms below ───
/** Number input that must be filled: '' counts as missing, not 0. */
const requiredNumber = (min: number, max: number, opts: { int?: boolean } = {}) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), opts.int ? z.coerce.number().int(MESSAGES.WHOLE_NUMBER).min(min).max(max) : z.coerce.number().min(min).max(max));
/** Optional number input: '' becomes null. */
const optionalNumber = (min: number, max: number) => z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(min).max(max).nullable());
const optionalPattern = (re: RegExp, message: string, upper = false) =>
  z.union([z.literal(''), (upper ? z.string().trim().toUpperCase() : z.string().trim()).pipe(z.string().regex(re, message))]).optional();
const optionalUrl = z.union([z.literal(''), z.string().trim().url().max(200)]).optional();
const amountField = requiredNumber(0, LIMITS.AMOUNT_MAX).refine((v) => Math.round(v * 100) === v * 100, 'Use at most 2 decimal places');
const positiveAmount = amountField.refine((v) => v > 0, 'Amount must be greater than 0');

// ─── Settings (one schema per section; unknown keys pass through untouched) ───
export const settingsSchemas: Record<string, z.ZodTypeAny> = {
  bookingTracker: z
    .object({
      steps: z
        .array(
          z.object({
            status: z.string(),
            visible: z.boolean(),
            label: z.string().trim().min(1, 'Required').max(TRACKER.LABEL_MAX, `Maximum ${TRACKER.LABEL_MAX} characters`),
            title: z.string().trim().min(1, 'Required').max(TRACKER.TITLE_MAX, `Maximum ${TRACKER.TITLE_MAX} characters`),
            hint: z.string().trim().max(TRACKER.HINT_MAX, `Maximum ${TRACKER.HINT_MAX} characters`),
          }),
        )
        .length(TRACKER.STEPS.length),
    })
    .passthrough(),
  company: z
    .object({
      name: t(2, 100, 'Company name'),
      legalName: opt(150),
      tagline: opt(150),
      gstin: optionalPattern(PATTERNS.GSTIN, MESSAGES.GSTIN, true),
      stateCode: optionalPattern(PATTERNS.GST_STATE_CODE, MESSAGES.GST_STATE_CODE),
      phone: optionalMobile,
      email: optionalEmail,
      website: optionalUrl,
      supportPhone: optionalMobile,
      supportWhatsapp: optionalMobile,
      address: opt(LIMITS.ADDRESS_MAX),
    })
    .passthrough(),
  general: z
    .object({
      allowCustomerCancellationHours: requiredNumber(0, 168, { int: true }),
      requireCompletionOtp: z.boolean(),
      technicianCanReject: z.boolean(),
      showTechnicianPhoneToCustomer: z.boolean(),
      timezone: t(3, 64, 'Timezone'),
    })
    .passthrough(),
  gst: z
    .object({
      enabled: z.boolean(),
      defaultRate: z.coerce.number().refine((v) => [0, 5, 12, 18, 28].includes(v), 'Choose 0, 5, 12, 18 or 28%'),
      sacCode: optionalPattern(PATTERNS.SAC_CODE, MESSAGES.SAC_CODE),
    })
    .passthrough(),
  payment: z
    .object({
      policy: z.enum(['PAY_AFTER_SERVICE', 'PREPAID_REQUIRED']),
      upiEnabled: z.boolean(),
      upiId: optionalPattern(PATTERNS.UPI_ID, MESSAGES.UPI_ID),
      upiPayeeName: opt(100),
      cashEnabled: z.boolean(),
      razorpayEnabled: z.boolean(),
    })
    .passthrough()
    .superRefine((v, ctx) => {
      if (v.upiEnabled && !v.upiId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['upiId'], message: 'Enter the UPI ID customers pay to' });
      if (v.upiEnabled && !v.upiPayeeName?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['upiPayeeName'], message: 'Enter the name shown to customers' });
      if (!v.upiEnabled && !v.cashEnabled && !v.razorpayEnabled) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cashEnabled'], message: 'Turn on at least one payment method' });
    }),
  reminder: z
    .object({
      enabled: z.boolean(),
      defaultIntervalMonths: requiredNumber(1, 36, { int: true }),
      daysBeforeDue: requiredNumber(0, 60, { int: true }),
      amcExpiryNoticeDays: requiredNumber(0, 180, { int: true }),
    })
    .passthrough(),
  notification: z.object({ inApp: z.boolean(), push: z.boolean(), email: z.boolean(), whatsapp: z.boolean() }).passthrough(),
  whatsapp: z
    .object({ manualSharingEnabled: z.boolean(), businessNumber: optionalMobile, cloudApiEnabled: z.boolean() })
    .passthrough()
    .superRefine((v, ctx) => {
      if (v.cloudApiEnabled && !v.businessNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['businessNumber'], message: 'Required when the Cloud API is on' });
    }),
  email: z.object({ sendBookingUpdates: z.boolean(), sendInvoices: z.boolean(), sendReminders: z.boolean() }).passthrough(),
  workingHours: z
    .object({
      workingDays: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one working day'),
      startTime: timeField,
      endTime: timeField,
      slotDurationMinutes: requiredNumber(30, 480, { int: true }),
      maxJobsPerSlot: requiredNumber(1, 100, { int: true }),
    })
    .passthrough()
    .refine((v) => v.endTime > v.startTime, { message: 'Day must end after it starts', path: ['endTime'] }),
  appHome: z
    .object({
      announcement: opt(APP_CONTENT.ANNOUNCEMENT_MAX),
      slides: z
        .array(
          z.object({
            enabled: z.boolean(),
            tag: opt(APP_CONTENT.TAG_MAX),
            title: req(APP_CONTENT.TITLE_MAX),
            subtitle: opt(APP_CONTENT.SUBTITLE_MAX),
            buttonText: req(APP_CONTENT.BUTTON_MAX),
            action: z.string(),
            style: z.string(),
          }),
        )
        .max(APP_CONTENT.MAX_SLIDES),
      trustPoints: z.array(req(APP_CONTENT.TRUST_MAX)).length(APP_CONTENT.TRUST_POINTS),
      todayCard: z.object({ enabled: z.boolean(), title: req(APP_CONTENT.TITLE_MAX), subtitle: opt(APP_CONTENT.SUBTITLE_MAX), buttonText: req(APP_CONTENT.BUTTON_MAX) }),
      showCategories: z.boolean(),
      showPopular: z.boolean(),
      showTrustPoints: z.boolean(),
      onboarding: z.array(z.object({ title: req(APP_CONTENT.ONBOARDING_TITLE_MAX), text: opt(APP_CONTENT.ONBOARDING_TEXT_MAX) })).length(APP_CONTENT.ONBOARDING_PAGES),
    })
    .passthrough(),
};

// ─── Master data (one schema per resource) ───
const latitudeField = optionalNumber(-90, 90);
const longitudeField = optionalNumber(-180, 180);
export const masterSchemas: Record<string, z.ZodTypeAny> = {
  states: z.object({ name: nameField, code: z.string().trim().toUpperCase().min(2).max(10).regex(/^[A-Z]+$/, 'Letters only, e.g. CG'), isActive: z.boolean() }),
  cities: z.object({ stateId: idField, name: nameField, isActive: z.boolean() }),
  branches: z.object({
    stateIdUi: idField,
    cityId: idField,
    code: z.string().trim().toUpperCase().min(2).max(20).regex(PATTERNS.MASTER_CODE, MESSAGES.MASTER_CODE),
    name: nameField,
    address: opt(LIMITS.ADDRESS_MAX),
    phone: optionalMobile,
    email: optionalEmail,
    gstin: optionalPattern(PATTERNS.GSTIN, MESSAGES.GSTIN, true),
    latitude: latitudeField,
    longitude: longitudeField,
    isActive: z.boolean(),
  }),
  'service-areas': z.object({
    branchId: idField,
    name: nameField,
    pincodes: optionalPattern(PATTERNS.PINCODE_LIST, MESSAGES.PINCODE_LIST),
    latitude: latitudeField,
    longitude: longitudeField,
    radiusKm: optionalNumber(0, 500),
    isActive: z.boolean(),
  }),
  skills: z.object({ name: nameField, isActive: z.boolean() }),
  products: z.object({ name: nameField, category: opt(100), sortOrder: z.preprocess((v) => (v === '' || v === undefined ? 0 : v), z.coerce.number().int().min(0).max(9999)), isActive: z.boolean() }),
};

// ─── Catalog ───
export const categorySchema = z.object({
  name: nameField,
  description: descriptionField,
  icon: z.union([z.literal(''), z.string().trim().max(50).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens, e.g. air-vent')]).optional(),
  isActive: z.boolean(),
});
export const priceSchema = z.object({ price: amountField });

// ─── Roles & templates ───
export const roleSchema = z.object({
  name: t(2, 100, 'Role name'),
  code: z.string().trim().toUpperCase().min(2).max(50).regex(PATTERNS.ROLE_CODE, MESSAGES.ROLE_CODE),
});
export const templateSchema = z.object({
  subject: opt(LIMITS.TEMPLATE_SUBJECT_MAX),
  body: t(1, LIMITS.TEMPLATE_BODY_MAX, 'Message'),
  isActive: z.boolean(),
});

// ─── Slots ───
const DAY_MS = 86_400_000;
export const slotGenerateSchema = z
  .object({
    fromDate: dateField,
    toDate: dateField,
    startTime: timeField,
    endTime: timeField,
    slotDurationMinutes: requiredNumber(30, 480, { int: true }),
    capacity: requiredNumber(1, 100, { int: true }),
    workingDays: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one working day'),
  })
  .superRefine((v, ctx) => {
    if (v.toDate < v.fromDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toDate'], message: 'Must be on or after the start date' });
    else if ((Date.parse(v.toDate) - Date.parse(v.fromDate)) / DAY_MS > LIMITS.SLOT_DAYS_MAX) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toDate'], message: `At most ${LIMITS.SLOT_DAYS_MAX} days at a time` });
    if (v.endTime <= v.startTime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'Must be after the start time' });
    else {
      const [sh, sm] = v.startTime.split(':').map(Number);
      const [eh, em] = v.endTime.split(':').map(Number);
      if (eh * 60 + em - (sh * 60 + sm) < v.slotDurationMinutes) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slotDurationMinutes'], message: 'Longer than the working window' });
    }
  });

// ─── Finance ───
export const invoiceLineSchema = z.object({
  description: t(2, 500, 'Description'),
  quantity: requiredNumber(1, 999, { int: true }),
  rate: amountField,
});
export const invoiceHeaderSchema = z.object({
  customerId: z.number({ required_error: 'Select a customer' }).int().positive('Select a customer'),
  branchId: z.number({ required_error: 'Select a branch', invalid_type_error: 'Select a branch' }).int().positive('Select a branch'),
});
export const manualInvoiceSchema = invoiceHeaderSchema.extend({ lines: z.array(invoiceLineSchema).min(1, 'Add at least one line') });
export const ledgerAdjustmentSchema = z.object({ amount: positiveAmount, description: t(3, 500, 'Description') });
export const refundSchema = (max: number) =>
  z.object({ amount: positiveAmount.refine((v) => v <= max, `Cannot exceed the paid amount (₹${max})`), reason: t(3, LIMITS.NOTES_MAX, 'Reason') });

// ─── Account ───
export const profileSchema = z
  .object({ name: nameField, email: optionalEmail, mobile: mobileField, username: usernameField.optional().or(z.literal('')) })
  .refine((v) => !!v.email || !!v.username, { message: 'Keep an email or a username to sign in', path: ['email'] });
export type ProfileForm = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({ current: z.string().min(1, 'Enter your current password'), next: passwordField, confirm: z.string().min(1, 'Re-enter the new password') })
  .refine((v) => v.next === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
  .refine((v) => v.next !== v.current, { message: 'Choose a password different from the current one', path: ['next'] });

/** Converts '' to undefined/null for optional API fields. */
export const emptyToNull = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])) as T;
