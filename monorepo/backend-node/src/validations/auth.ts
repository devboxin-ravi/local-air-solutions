import { z } from 'zod';
import { Limits } from '../constants';
import { email, id, latitude, longitude, mobile, name, optionalEmail, password, pincode, trimmed, optionalTrimmed } from './common';

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(Limits.EMAIL_MAX),
  password: z.string().min(1).max(Limits.PASSWORD_MAX),
});

export const otpVerifySchema = z.object({
  userId: id,
  code: z.string().trim().regex(/^\d{6}$/),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export const logoutSchema = z.object({ refreshToken: z.string().max(200).optional() });

export const forgotPasswordSchema = z.object({ identifier: z.string().trim().min(3).max(Limits.EMAIL_MAX) });

export const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(3).max(Limits.EMAIL_MAX),
  code: z.string().trim().regex(/^\d{6}$/),
  newPassword: password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(Limits.PASSWORD_MAX),
  newPassword: password,
});

export const addressInput = z.object({
  label: trimmed(1, 50).default('Home'),
  line1: trimmed(Limits.ADDRESS_MIN, Limits.ADDRESS_MAX),
  line2: optionalTrimmed(Limits.ADDRESS_MAX),
  landmark: optionalTrimmed(200),
  stateId: id,
  cityId: id,
  pincode,
  latitude,
  longitude,
});

export const registerCustomerSchema = z.object({
  fullName: name,
  mobile,
  email: optionalEmail,
  password,
  branchId: id.optional().nullable(),
  address: addressInput.optional(),
});
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;

export const deviceTokenSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(['android', 'ios', 'web']),
});

export const emailOnly = z.object({ email });
