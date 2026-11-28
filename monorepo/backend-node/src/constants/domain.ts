/**
 * Business-domain constants: booking workflow, numbering, finance, AMC, reminders.
 */

import { BookingStatus } from '@prisma/client';

/** Allowed booking status transitions (validated on the backend). */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_VERIFICATION', 'CONFIRMED', 'CANCELLED', 'REJECTED'],
  PAYMENT_VERIFICATION: ['CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['ASSIGNED', 'RESCHEDULED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED'],
  ACCEPTED: ['ON_THE_WAY', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED'],
  ON_THE_WAY: ['ARRIVED', 'RESCHEDULED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'RESCHEDULED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  RESCHEDULED: ['CONFIRMED', 'ASSIGNED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

/** Statuses a technician may set from the field app, in order. */
export const TECHNICIAN_FLOW: BookingStatus[] = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];

/** Statuses that hold a slot reservation. */
export const SLOT_HOLDING_STATUSES: BookingStatus[] = [
  'PENDING_PAYMENT',
  'PAYMENT_VERIFICATION',
  'CONFIRMED',
  'ASSIGNED',
  'ACCEPTED',
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
  'RESCHEDULED',
];

export const ACTIVE_JOB_STATUSES: BookingStatus[] = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];
export const PENDING_BOOKING_STATUSES: BookingStatus[] = ['PENDING_PAYMENT', 'PAYMENT_VERIFICATION', 'CONFIRMED', 'RESCHEDULED'];
export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ['COMPLETED', 'CANCELLED', 'REJECTED'];

/** Document number prefixes. Final format: PREFIX-YYYY-000001 */
export const NumberPrefixes = {
  BOOKING: 'LAS',
  INVOICE: 'INV',
  PAYMENT: 'PAY',
  AMC: 'AMC',
  CUSTOMER: 'CUS',
  STAFF: 'STF',
} as const;
export const NUMBER_PAD_LENGTH = 6;

export const Finance = {
  DEFAULT_GST_RATE: 18,
  MONEY_DECIMALS: 2,
  CURRENCY: 'INR',
  SAC_CODE_SERVICES: '998719',
} as const;

export const ReferenceTypes = {
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  ADJUSTMENT: 'ADJUSTMENT',
  OPENING: 'OPENING',
} as const;

export const Amc = {
  EXPIRING_WINDOW_DAYS: 30,
  DEFAULT_VISITS: 4,
  DEFAULT_FREQUENCY_MONTHS: 3,
} as const;

export const Reminders = {
  DEFAULT_INTERVAL_MONTHS: 6,
  UPCOMING_WINDOW_DAYS: 15,
  MAX_NOTIFY_COUNT: 3,
  RENOTIFY_AFTER_DAYS: 7,
} as const;

export const Slots = {
  DEFAULT_CAPACITY: 3,
  DEFAULT_DURATION_MINUTES: 120,
  MAX_GENERATE_DAYS: 60,
} as const;

export const Assignment = {
  SUGGESTION_LIMIT: 10,
  SCORE_SAME_AREA: 40,
  SCORE_PER_SKILL: 15,
  SCORE_AVAILABLE: 20,
  WORKLOAD_PENALTY: 8,
} as const;

export const Notifications = {
  MAX_ATTEMPTS: 5,
  BATCH_SIZE: 50,
} as const;

export const NotificationEvents = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  TECHNICIAN_ASSIGNED: 'TECHNICIAN_ASSIGNED',
  ASSIGNMENT_ACCEPTED: 'ASSIGNMENT_ACCEPTED',
  ON_THE_WAY: 'ON_THE_WAY',
  ARRIVED: 'ARRIVED',
  WORK_STARTED: 'WORK_STARTED',
  SERVICE_COMPLETED: 'SERVICE_COMPLETED',
  INVOICE_GENERATED: 'INVOICE_GENERATED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  AMC_EXPIRING: 'AMC_EXPIRING',
  SERVICE_DUE: 'SERVICE_DUE',
  NEW_JOB: 'NEW_JOB',
} as const;

export const Otp = { LENGTH: 6 } as const;

export const AuditActions = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  ASSIGN: 'ASSIGN',
} as const;

/** Stock (spare parts / material) rules. */
export const StockRules = {
  UNITS: ['PCS', 'MTR', 'KG', 'LTR', 'SET', 'BOX'],
  MAX_QUANTITY: 1_000_000,
} as const;
