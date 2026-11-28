import { z } from 'zod';
import { Patterns, ValidationMessages } from '../constants';
import { StockRules } from '../constants/domain';
import { boolish, email, gstRate, hhmm, id, latitude, longitude, mobile, money, name, notes, optionalTrimmed, trimmed } from './common';

export const stateSchema = z.object({ name, code: trimmed(2, 10).toUpperCase(), isActive: z.boolean().default(true) });
export const citySchema = z.object({ stateId: id, name, isActive: z.boolean().default(true) });

export const branchSchema = z.object({
  cityId: id,
  code: trimmed(2, 20).toUpperCase(),
  name,
  address: optionalTrimmed(500),
  phone: z.union([z.literal(''), mobile]).optional().nullable().transform((v) => v || null),
  email: z.union([z.literal(''), email]).optional().nullable().transform((v) => v || null),
  gstin: z
    .union([z.literal(''), z.string().trim().toUpperCase().regex(Patterns.GSTIN, ValidationMessages.GSTIN)])
    .optional()
    .nullable()
    .transform((v) => v || null),
  latitude,
  longitude,
  isActive: z.boolean().default(true),
});

export const serviceAreaSchema = z.object({
  branchId: id,
  name,
  pincodes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .refine((v) => !v || v.split(',').every((p) => Patterns.PINCODE.test(p.trim())), 'Comma-separated 6-digit PIN codes'),
  latitude,
  longitude,
  radiusKm: z.coerce.number().min(0).max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const skillSchema = z.object({ name, isActive: z.boolean().default(true) });
export const productSchema = z.object({
  name,
  category: optionalTrimmed(100),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const stockQuantity = z.coerce.number().int().min(0).max(StockRules.MAX_QUANTITY);

export const stockItemSchema = z.object({
  branchId: id,
  code: trimmed(1, 30).toUpperCase(),
  name,
  unit: z.enum(StockRules.UNITS),
  hsnCode: optionalTrimmed(20),
  salePrice: money,
  gstRate,
  quantity: stockQuantity.default(0),
  lowStockLevel: stockQuantity.default(0),
  isActive: z.boolean().default(true),
});
/** Branch and quantity are fixed after creation; quantity changes only through an adjustment. */
export const stockItemUpdateSchema = stockItemSchema.omit({ branchId: true, quantity: true }).partial();
export const stockAdjustSchema = z.object({
  change: z.coerce
    .number()
    .int()
    .min(-StockRules.MAX_QUANTITY)
    .max(StockRules.MAX_QUANTITY)
    .refine((v) => v !== 0, 'Quantity must not be zero'),
  note: notes,
});
export const stockListQuery = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  activeOnly: boolish.optional(),
  search: z.string().trim().max(100).optional(),
});

export const masterListQuery = z.object({
  stateId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  activeOnly: boolish.optional(),
  search: z.string().trim().max(100).optional(),
});

export const workingHoursSchema = z.object({ startTime: hhmm, endTime: hhmm });
