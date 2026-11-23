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

export const priceLabel = (s: { pricingType: string; basePrice: number | string }): string =>
  s.pricingType === 'QUOTATION' ? 'On quotation' : s.pricingType === 'FREE' ? 'Free' : `${s.pricingType === 'STARTING' ? 'From ' : ''}${formatMoney(s.basePrice)}`;
