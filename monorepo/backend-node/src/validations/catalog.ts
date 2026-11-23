import { z } from 'zod';
import { Limits, Patterns, ValidationMessages } from '../constants';
import { boolish, description, gstRate, id, listQuery, money, optionalTrimmed, trimmed } from './common';

export const categorySchema = z.object({
  name: trimmed(Limits.NAME_MIN, Limits.NAME_MAX),
  description,
  imageUrl: optionalTrimmed(500),
  icon: optionalTrimmed(50),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const serviceSchema = z
  .object({
    categoryId: id,
    code: trimmed(2, Limits.CODE_MAX).toUpperCase().pipe(z.string().regex(Patterns.SERVICE_CODE, ValidationMessages.SERVICE_CODE)),
    name: trimmed(Limits.NAME_MIN, Limits.NAME_MAX),
    description,
    imageUrl: optionalTrimmed(500),
    durationMinutes: z.coerce.number().int().min(10).max(24 * 60).default(60),
    pricingType: z.enum(['FIXED', 'STARTING', 'QUOTATION', 'FREE']),
    basePrice: money.default(0),
    gstApplicable: z.boolean().default(true),
    gstRate: gstRate.default(18),
    reminderEligible: z.boolean().default(false),
    reminderIntervalMonths: z.coerce.number().int().min(1).max(36).optional().nullable(),
    isPopular: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
    skillIds: z.array(id).max(50).default([]),
    branchIds: z.array(id).max(200).default([]),
  })
  .refine((v) => v.pricingType === 'FREE' || v.pricingType === 'QUOTATION' || v.basePrice > 0, {
    message: 'Price is required for fixed/starting price services',
    path: ['basePrice'],
  });

export const serviceUpdateSchema = z.object({
  categoryId: id.optional(),
  code: trimmed(2, Limits.CODE_MAX).toUpperCase().pipe(z.string().regex(Patterns.SERVICE_CODE, ValidationMessages.SERVICE_CODE)).optional(),
  name: trimmed(Limits.NAME_MIN, Limits.NAME_MAX).optional(),
  description,
  imageUrl: optionalTrimmed(500),
  durationMinutes: z.coerce.number().int().min(10).max(24 * 60).optional(),
  pricingType: z.enum(['FIXED', 'STARTING', 'QUOTATION', 'FREE']).optional(),
  basePrice: money.optional(),
  gstApplicable: z.boolean().optional(),
  gstRate: gstRate.optional(),
  reminderEligible: z.boolean().optional(),
  reminderIntervalMonths: z.coerce.number().int().min(1).max(36).optional().nullable(),
  isPopular: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  skillIds: z.array(id).max(50).optional(),
  branchIds: z.array(id).max(200).optional(),
});

export const serviceListQuery = listQuery.extend({
  categoryId: z.coerce.number().int().positive().optional(),
  isActive: boolish.optional(),
  isPopular: boolish.optional(),
  pricingType: z.enum(['FIXED', 'STARTING', 'QUOTATION', 'FREE']).optional(),
});

export const pricingSchema = z.object({
  branchId: id.optional().nullable(),
  price: money,
});

export const reorderSchema = z.object({ ids: z.array(id).min(1).max(500) });
export const activeSchema = z.object({ isActive: z.boolean() });
