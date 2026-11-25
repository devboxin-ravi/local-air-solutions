/**
 * Reusable Zod building blocks. Strings are trimmed; Unicode names and real-world
 * address punctuation are allowed; input is never silently truncated.
 */

import { z } from 'zod';
import { Limits, Pagination, Patterns, ValidationMessages } from '../constants';

export const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v));

export const name = trimmed(Limits.NAME_MIN, Limits.NAME_MAX);
export const mobile = z.string().trim().regex(Patterns.INDIAN_MOBILE, ValidationMessages.MOBILE);
export const optionalMobile = z
  .union([z.literal(''), mobile])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
export const email = z.string().trim().toLowerCase().email().max(Limits.EMAIL_MAX);
export const optionalEmail = z
  .union([z.literal(''), email])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
export const username = z.string().trim().toLowerCase().regex(Patterns.USERNAME, ValidationMessages.USERNAME);
export const optionalUsername = z
  .union([z.literal(''), username])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
export const password = z
  .string()
  .min(Limits.PASSWORD_MIN)
  .max(Limits.PASSWORD_MAX)
  .regex(Patterns.PASSWORD, ValidationMessages.PASSWORD);
export const pincode = z.string().trim().regex(Patterns.PINCODE, ValidationMessages.PINCODE);
export const notes = optionalTrimmed(Limits.NOTES_MAX);
export const description = optionalTrimmed(Limits.DESCRIPTION_MAX);
export const hhmm = z.string().regex(Patterns.TIME_HHMM, ValidationMessages.TIME);
export const id = z.coerce.number().int().positive();
export const optionalId = z.coerce.number().int().positive().optional().nullable();
export const money = z.coerce.number().min(0).max(Limits.AMOUNT_MAX).multipleOf(0.01);
export const gstRate = z.coerce.number().min(0).max(Limits.GST_RATE_MAX);
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const latitude = z.coerce.number().min(-90).max(90).optional().nullable();
export const longitude = z.coerce.number().min(-180).max(180).optional().nullable();
export const boolish = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

export const idParams = z.object({ id });

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(Pagination.DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(Pagination.MAX_PAGE_SIZE).default(Pagination.DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(Limits.SEARCH_MAX).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  branchId: z.coerce.number().int().positive().optional(),
});

export const dateRangeQuery = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export type ListQueryInput = z.infer<typeof listQuery>;
