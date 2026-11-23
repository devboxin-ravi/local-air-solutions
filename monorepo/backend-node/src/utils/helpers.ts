/**
 * Pure helper functions: money, dates, crypto, pagination, templating, WhatsApp links.
 * No I/O, no DB access.
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Pagination, NUMBER_PAD_LENGTH, Otp } from '../constants';

// ─── Money ───
export type MoneyInput = Prisma.Decimal | number | string;

export const toDecimal = (v: MoneyInput | null | undefined): Prisma.Decimal => new Prisma.Decimal(v ?? 0);

/** Round half-up to 2 decimal places. */
export const round2 = (v: MoneyInput): Prisma.Decimal => toDecimal(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const moneyNumber = (v: MoneyInput | null | undefined): number => Number(round2(v ?? 0).toFixed(2));

export const formatInr = (v: MoneyInput): string =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(moneyNumber(v));

// ─── Dates ───
export const startOfDay = (d: Date): Date => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

/** Parses YYYY-MM-DD as a UTC date-only value (matches MySQL DATE). */
export const parseDateOnly = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

export const toDateOnlyString = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (d: Date, days: number): Date => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
};

export const addMonths = (d: Date, months: number): Date => {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
};

export const todayDateOnly = (): Date => parseDateOnly(new Date().toISOString().slice(0, 10));

export const timeToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const formatDisplayDate = (d: Date): string =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

// ─── Crypto ───
export const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 48): string => crypto.randomBytes(bytes).toString('base64url');

export const generateOtp = (): string =>
  String(crypto.randomInt(0, 10 ** Otp.LENGTH)).padStart(Otp.LENGTH, '0');

export const safeEqual = (a: string, b: string): boolean => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

export const hmacSha256Hex = (secret: string, payload: string | Buffer): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

// ─── Numbering ───
export const formatDocNumber = (prefix: string, year: number, seq: number): string =>
  `${prefix}-${year}-${String(seq).padStart(NUMBER_PAD_LENGTH, '0')}`;

export const formatCode = (prefix: string, seq: number): string => `${prefix}${String(seq).padStart(5, '0')}`;

// ─── Pagination ───
export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const toPageParams = (page?: number, pageSize?: number): PageParams => {
  const p = Math.max(Pagination.DEFAULT_PAGE, page ?? Pagination.DEFAULT_PAGE);
  const s = Math.min(Pagination.MAX_PAGE_SIZE, Math.max(1, pageSize ?? Pagination.DEFAULT_PAGE_SIZE));
  return { page: p, pageSize: s, skip: (p - 1) * s, take: s };
};

export const toPageMeta = (params: PageParams, total: number): PageMeta => ({
  page: params.page,
  pageSize: params.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
});

// ─── Templating & sharing ───
export const renderTemplate = (text: string, data: Record<string, unknown>): string =>
  text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) =>
    data[key] === undefined || data[key] === null ? '' : String(data[key]),
  );

/** Builds a correctly encoded wa.me link. Phone must include country code digits. */
export const buildWhatsAppLink = (countryCode: string, mobile: string, message: string): string => {
  const phone = `${countryCode}${mobile}`.replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');

/** Remove undefined keys (for Prisma partial updates). */
export const compact = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
