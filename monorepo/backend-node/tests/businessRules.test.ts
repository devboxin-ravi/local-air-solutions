/**
 * Unit tests for pure business rules: GST invoice maths, booking transitions,
 * branch-scoped authorization and helpers.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://test:test@localhost:3306/test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'x'.repeat(40);

import { calculateInvoice } from '../src/services/invoiceService';
import { BOOKING_TRANSITIONS } from '../src/constants/domain';
import { assertBranchAccess, resolveBranchScope } from '../src/services/accessControl';
import { addMonths, buildWhatsAppLink, formatDocNumber, parseDateOnly, renderTemplate } from '../src/utils/helpers';
import type { AuthUser } from '../src/models';

const actor = (over: Partial<AuthUser>): AuthUser => ({
  id: 1,
  name: 'A',
  email: null,
  mobile: '9000000000',
  userType: 'ADMIN',
  roles: [],
  permissions: [],
  branchId: null,
  isSuperAdmin: false,
  isCompanyWide: false,
  customerId: null,
  staffId: null,
  ...over,
});

describe('calculateInvoice (GST)', () => {
  const lines = [
    { description: 'AC General Servicing', quantity: 2, rate: 499, gstRate: 18 },
    { description: 'Drain cleaning', quantity: 1, rate: 399, gstRate: 18 },
  ];

  it('computes intra-state CGST/SGST split', () => {
    const t = calculateInvoice(lines, { applyGst: true, isInterState: false, discount: 0, isFreeService: false });
    expect(t.subtotal).toBe(1397);
    expect(t.gstTotal).toBeCloseTo(251.46, 2);
    expect(t.cgst + t.sgst).toBeCloseTo(t.gstTotal, 2);
    expect(t.igst).toBe(0);
    // 1648.46 is rounded up to the next rupee.
    expect(t.roundOff).toBeCloseTo(0.54, 2);
    expect(t.grandTotal).toBe(1649);
  });

  it('uses IGST for inter-state', () => {
    const t = calculateInvoice(lines, { applyGst: true, isInterState: true, discount: 0, isFreeService: false });
    expect(t.cgst).toBe(0);
    expect(t.igst).toBeCloseTo(251.46, 2);
  });

  it('adds no tax when GST is unchecked', () => {
    const t = calculateInvoice(lines, { applyGst: false, isInterState: false, discount: 0, isFreeService: false });
    expect(t.gstTotal).toBe(0);
    expect(t.grandTotal).toBe(1397);
  });

  it('applies invoice discount before tax and never below zero', () => {
    const t = calculateInvoice(lines, { applyGst: true, isInterState: false, discount: 397, isFreeService: false });
    expect(t.taxableAmount).toBe(1000);
    expect(t.gstTotal).toBeCloseTo(180, 2);
    const big = calculateInvoice(lines, { applyGst: true, isInterState: false, discount: 999999, isFreeService: false });
    expect(big.grandTotal).toBe(0);
  });

  it('rounds the grand total up, never down', () => {
    const exact = calculateInvoice([{ description: 'Service', quantity: 1, rate: 1000, gstRate: 18 }], { applyGst: true, isInterState: false, discount: 0, isFreeService: false });
    expect(exact.roundOff).toBe(0);
    expect(exact.grandTotal).toBe(1180);
    const small = calculateInvoice([{ description: 'Part', quantity: 1, rate: 100.01, gstRate: 0 }], { applyGst: false, isInterState: false, discount: 0, isFreeService: false });
    expect(small.grandTotal).toBe(101);
    expect(small.roundOff).toBeCloseTo(0.99, 2);
  });

  it('records free services with original value retained', () => {
    const t = calculateInvoice(lines, { applyGst: true, isInterState: false, discount: 0, isFreeService: true });
    expect(t.subtotal).toBe(1397);
    expect(t.discount).toBe(1397);
    expect(t.grandTotal).toBe(0);
  });
});

describe('booking status transitions', () => {
  it('allows the field workflow in order', () => {
    expect(BOOKING_TRANSITIONS.ASSIGNED).toContain('ACCEPTED');
    expect(BOOKING_TRANSITIONS.ACCEPTED).toContain('ON_THE_WAY');
    expect(BOOKING_TRANSITIONS.ON_THE_WAY).toContain('ARRIVED');
    expect(BOOKING_TRANSITIONS.ARRIVED).toContain('IN_PROGRESS');
    expect(BOOKING_TRANSITIONS.IN_PROGRESS).toEqual(['COMPLETED']);
  });

  it('blocks skipping steps and reopening terminal states', () => {
    expect(BOOKING_TRANSITIONS.CONFIRMED).not.toContain('COMPLETED');
    expect(BOOKING_TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(BOOKING_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});

describe('branch-scoped authorization', () => {
  it('company-wide users can query any branch', () => {
    expect(resolveBranchScope(actor({ isCompanyWide: true }), 5)).toBe(5);
    expect(resolveBranchScope(actor({ isCompanyWide: true }))).toBeUndefined();
  });

  it('branch managers are pinned to their branch', () => {
    const bm = actor({ branchId: 2 });
    expect(resolveBranchScope(bm)).toBe(2);
    expect(() => resolveBranchScope(bm, 3)).toThrow();
    expect(() => assertBranchAccess(bm, 3)).toThrow();
    expect(() => assertBranchAccess(bm, 2)).not.toThrow();
  });
});

describe('helpers', () => {
  it('formats booking numbers', () => {
    expect(formatDocNumber('LAS', 2026, 1)).toBe('LAS-2026-000001');
  });

  it('adds months clamping to month end', () => {
    expect(addMonths(parseDateOnly('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(parseDateOnly('2026-05-15'), 6).toISOString().slice(0, 10)).toBe('2026-11-15');
  });

  it('builds encoded wa.me links', () => {
    expect(buildWhatsAppLink('+91', '9876543210', 'Hi & bye')).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye');
  });

  it('renders templates safely', () => {
    expect(renderTemplate('Booking {{n}} {{missing}}', { n: 'LAS-1' })).toBe('Booking LAS-1 ');
  });
});
