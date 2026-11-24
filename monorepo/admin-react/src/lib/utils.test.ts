import { describe, expect, it } from 'vitest';
import { formatMoney, humanize, initials, mapsDirectionsUrl, priceLabel } from './utils';
import { customerSchema, paymentSchema, serviceSchema } from './validation';
import { NAVIGATION, SETTINGS_MENU } from '@/constants/navigation';

describe('formatting helpers', () => {
  it('formats INR money', () => {
    expect(formatMoney(1177.64)).toBe('₹1,177.64');
    expect(formatMoney('100000')).toBe('₹1,00,000.00');
  });
  it('humanizes enums and builds initials', () => {
    expect(humanize('PAYMENT_VERIFICATION')).toBe('Payment Verification');
    expect(initials('Rahul Kumar Verma')).toBe('RK');
  });
  it('labels prices by pricing type', () => {
    expect(priceLabel({ pricingType: 'STARTING', basePrice: 499 })).toBe('From ₹499.00');
    expect(priceLabel({ pricingType: 'QUOTATION', basePrice: 0 })).toBe('On quotation');
  });
  it('never invents coordinates for maps', () => {
    expect(mapsDirectionsUrl(22.7, 75.8)).toContain('destination=22.7,75.8');
    expect(mapsDirectionsUrl(null, null, 'MG Road Indore')).toContain('search/?api=1&query=MG%20Road%20Indore');
  });
});

describe('form validation', () => {
  it('validates customer mobile and allows unicode names', () => {
    const base = { fullName: 'Ñandú José', mobile: '9876543210', customerType: 'INDIVIDUAL', status: 'ACTIVE' };
    expect(customerSchema.safeParse(base).success).toBe(true);
    expect(customerSchema.safeParse({ ...base, mobile: '12345' }).success).toBe(false);
  });
  it('requires a price for fixed services but not for quotations', () => {
    const s = { categoryId: 1, code: 'AC-1', name: 'AC Service', durationMinutes: 60, pricingType: 'FIXED', basePrice: 0, gstApplicable: true, gstRate: 18, reminderEligible: false, isPopular: false, isActive: true, skillIds: [], branchIds: [] };
    expect(serviceSchema.safeParse(s).success).toBe(false);
    expect(serviceSchema.safeParse({ ...s, pricingType: 'QUOTATION' }).success).toBe(true);
  });
  it('requires a reference for non-cash payments', () => {
    expect(paymentSchema.safeParse({ method: 'UPI_MANUAL', amount: 100, referenceNumber: '' }).success).toBe(false);
    expect(paymentSchema.safeParse({ method: 'CASH', amount: 100, referenceNumber: '' }).success).toBe(true);
  });
});

describe('top navigation', () => {
  it('has the 9 top-bar modules in order with no sidebar', () => {
    expect(NAVIGATION.map((m) => m.label)).toEqual(['Dashboard', 'Bookings', 'Services', 'Assignments', 'Customers', 'AMC', 'Finance', 'Reports', 'Master Data']);
  });
  it('keeps Settings out of the top bar, in the profile menu', () => {
    expect(SETTINGS_MENU.permission).toBeTruthy();
    expect(SETTINGS_MENU.children.length).toBeGreaterThan(0);
  });
  it('every module has a permission and submenu items', () => {
    NAVIGATION.forEach((m) => {
      expect(m.permission).toBeTruthy();
      expect(m.children.length).toBeGreaterThan(0);
    });
  });
});
