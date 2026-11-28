/**
 * Application configuration.
 *
 * Loads and validates ALL environment variables with Zod.
 * NEVER access process.env anywhere else — import `config` from here.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const bool = (def: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true'));

const csv = (def: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? def).split(',').map((s) => s.trim()).filter(Boolean));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('Local Air Solutions API'),
  APP_VERSION: z.string().default('1.0.0'),
  PORT: z.coerce.number().int().positive().default(8000),
  DEBUG: bool(false),
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:8000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  /** Admin-panel sign-ins end this many days after login (not extended by token refresh). */
  JWT_ADMIN_SESSION_DAYS: z.coerce.number().int().positive().default(7),
  JWT_ISSUER: z.string().default('local-air-solutions'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  OTP_ENABLED: bool(false),
  OTP_EXPIRES_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  CORS_ORIGINS: csv('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(8),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Local Air Solutions <no-reply@localairsolutions.in>'),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  /** Master key that encrypts integration secrets saved from the admin panel (≥ 32 chars). */
  SECRETS_ENCRYPTION_KEY: z.string().min(32, 'SECRETS_ENCRYPTION_KEY must be at least 32 chars').optional(),

  WHATSAPP_CLOUD_ENABLED: bool(false),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),

  JOBS_ENABLED: bool(true),
  REMINDER_CRON: z.string().default('0 8 * * *'),
  NOTIFICATION_CRON: z.string().default('*/2 * * * *'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@localairsolutions.in'),
  SEED_ADMIN_MOBILE: z.string().default('9000000001'),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}
const env = parsed.data;

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  appName: string;
  appVersion: string;
  port: number;
  debug: boolean;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  publicBaseUrl: string;
  databaseUrl: string;
  jwt: { accessSecret: string; accessExpiresMinutes: number; refreshExpiresDays: number; adminSessionDays: number; issuer: string };
  security: {
    bcryptRounds: number;
    loginMaxAttempts: number;
    loginLockMinutes: number;
    otpEnabled: boolean;
    otpExpiresMinutes: number;
    otpMaxAttempts: number;
  };
  corsOrigins: string[];
  rateLimit: { windowMinutes: number; max: number; authMax: number };
  upload: { dir: string; maxBytes: number };
  smtp: { host?: string; port: number; secure: boolean; user?: string; password?: string; from: string; enabled: boolean };
  razorpay: { keyId?: string; keySecret?: string; webhookSecret?: string; enabled: boolean };
  secrets: { encryptionKey?: string };
  whatsapp: { cloudEnabled: boolean; phoneNumberId?: string; accessToken?: string };
  fcm: { projectId?: string; clientEmail?: string; privateKey?: string; enabled: boolean };
  jobs: { enabled: boolean; reminderCron: string; notificationCron: string };
  seed: { adminEmail: string; adminMobile: string; adminPassword?: string };
}

export const config: AppConfig = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  appName: env.APP_NAME,
  appVersion: env.APP_VERSION,
  port: env.PORT,
  debug: env.DEBUG,
  logLevel: env.LOG_LEVEL,
  publicBaseUrl: env.PUBLIC_BASE_URL,
  databaseUrl: env.DATABASE_URL,
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiresMinutes: env.JWT_ACCESS_EXPIRES_MINUTES,
    refreshExpiresDays: env.JWT_REFRESH_EXPIRES_DAYS,
    adminSessionDays: env.JWT_ADMIN_SESSION_DAYS,
    issuer: env.JWT_ISSUER,
  },
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    loginMaxAttempts: env.LOGIN_MAX_ATTEMPTS,
    loginLockMinutes: env.LOGIN_LOCK_MINUTES,
    otpEnabled: env.OTP_ENABLED,
    otpExpiresMinutes: env.OTP_EXPIRES_MINUTES,
    otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
  },
  corsOrigins: env.CORS_ORIGINS,
  rateLimit: { windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES, max: env.RATE_LIMIT_MAX, authMax: env.AUTH_RATE_LIMIT_MAX },
  upload: { dir: env.UPLOAD_DIR, maxBytes: Math.round(env.UPLOAD_MAX_MB * 1024 * 1024) },
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
    enabled: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD),
  },
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    enabled: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  },
  secrets: { encryptionKey: env.SECRETS_ENCRYPTION_KEY },
  whatsapp: {
    cloudEnabled: env.WHATSAPP_CLOUD_ENABLED && Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
  },
  fcm: {
    projectId: env.FCM_PROJECT_ID,
    clientEmail: env.FCM_CLIENT_EMAIL,
    privateKey: env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    enabled: Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY),
  },
  jobs: { enabled: env.JOBS_ENABLED, reminderCron: env.REMINDER_CRON, notificationCron: env.NOTIFICATION_CRON },
  seed: { adminEmail: env.SEED_ADMIN_EMAIL, adminMobile: env.SEED_ADMIN_MOBILE, adminPassword: env.SEED_ADMIN_PASSWORD },
};
