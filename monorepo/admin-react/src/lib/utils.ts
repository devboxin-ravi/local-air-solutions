/**
 * Small pure UI helpers (class merging, formatting). No API, no state.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { config } from '@/config';
import { DATE_FORMATS, LOCALE } from '@/constants/ui';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const toNumber = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));

export const formatMoney = (v: unknown, withSymbol = true): string =>
  `${withSymbol ? '₹' : ''}${new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(v))}`;

export const formatCompactMoney = (v: unknown): string =>
  `₹${new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(toNumber(v))}`;

export const formatNumber = (v: unknown): string => new Intl.NumberFormat(LOCALE).format(toNumber(v));

const asDate = (d: string | Date): Date => (typeof d === 'string' ? parseISO(d) : d);

export const formatDate = (d?: string | Date | null): string => (d ? format(asDate(d), DATE_FORMATS.DISPLAY) : '—');
export const formatDateTime = (d?: string | Date | null): string => (d ? format(asDate(d), DATE_FORMATS.DISPLAY_TIME) : '—');
export const formatRelative = (d?: string | Date | null): string => (d ? formatDistanceToNow(asDate(d), { addSuffix: true }) : '—');
export const toYmd = (d: Date): string => format(d, DATE_FORMATS.ISO_DATE);
export const formatWith = (d: string | Date, pattern: string): string => format(asDate(d), pattern);

const MONTH_KEY = /^\d{4}-\d{2}$/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Every month key (yyyy-MM) from the month of `from` to the month of `to`, inclusive. */
export const monthKeysBetween = (from: string, to: string): string[] => {
  const keys: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
};

/** Short chart label for a period key: "Nov '26" for yyyy-MM, "24 Nov" for yyyy-MM-dd. */
export const formatPeriod = (key: string): string => {
  if (MONTH_KEY.test(key)) return format(parseISO(`${key}-01`), DATE_FORMATS.MONTH_SHORT);
  if (DAY_KEY.test(key)) return format(parseISO(key), DATE_FORMATS.DAY_SHORT);
  return key;
};

export const humanize = (s?: string | null): string =>
  s ? s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

export const initials = (name?: string | null): string =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

/** Resolves an uploaded file path (/uploads/...) to an absolute URL. */
export const assetUrl = (path?: string | null): string | undefined =>
  !path ? undefined : /^https?:\/\//.test(path) ? path : `${config.assetBaseUrl}${path}`;

export const mapsDirectionsUrl = (lat?: number | string | null, lng?: number | string | null, fallbackQuery?: string): string =>
  lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery ?? '')}`;

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Password rules shown live on the change-password form (mirror the backend policy). */
export const passwordChecks = (pw: string) => [
  { label: 'At least 8 characters', ok: pw.length >= 8 },
  { label: 'Contains a letter', ok: /[A-Za-z]/.test(pw) },
  { label: 'Contains a number', ok: /\d/.test(pw) },
];

/** 90 → "1 hr 30 min", 45 → "45 min". */
export const formatDuration = (minutes: number): string => {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return [h ? `${h} hr` : '', r || !h ? `${r} min` : ''].filter(Boolean).join(' ');
};

/** "AC General Servicing" → "AC-GEN-SER" — a suggested unique service code (letters/digits, max 30). */
export const codeFromName = (name: string, max = 30): string =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => (w.length <= 3 ? w : w.slice(0, 3)))
    .join('-')
    .slice(0, max);

export const priceLabel = (s: { pricingType: string; basePrice: number | string }): string =>
  s.pricingType === 'QUOTATION' ? 'On quotation' : s.pricingType === 'FREE' ? 'Free' : `${s.pricingType === 'STARTING' ? 'From ' : ''}${formatMoney(s.basePrice)}`;
