/**
 * Client-side Zod form schemas (mirrors backend validation; the server re-validates everything).
 * Strings are trimmed; Unicode names and real-world address punctuation are allowed.
 */

import { z } from 'zod';
import { LIMITS, MESSAGES, PATTERNS } from '@/constants/ui';

const t = (min: number, max: number, label = 'This field') =>
  z.string().trim().min(min, min === 1 ? MESSAGES.REQUIRED : `${label} must be at least ${min} characters`).max(max, `Maximum ${max} characters`);
const opt = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`).optional().or(z.literal(''));

export const nameField = t(LIMITS.NAME_MIN, LIMITS.NAME_MAX, 'Name');
export const mobileField = z.string().trim().regex(PATTERNS.MOBILE, MESSAGES.MOBILE);
export const optionalMobile = z.string().trim().regex(PATTERNS.MOBILE, MESSAGES.MOBILE).optional().or(z.literal(''));
export const emailField = z.string().trim().toLowerCase().email('Enter a valid email').max(LIMITS.EMAIL_MAX);
export const optionalEmail = emailField.optional().or(z.literal(''));
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
});
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

/** Converts '' to undefined/null for optional API fields. */
export const emptyToNull = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])) as T;
