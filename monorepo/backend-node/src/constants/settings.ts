/**
 * Company settings keys and their default values.
 * Stored as JSON rows in `company_settings`.
 */

export const SettingKeys = {
  COMPANY: 'company',
  GENERAL: 'general',
  GST: 'gst',
  PAYMENT: 'payment',
  REMINDER: 'reminder',
  NOTIFICATION: 'notification',
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  WORKING_HOURS: 'workingHours',
  APP_HOME: 'appHome',
} as const;
export type SettingKey = (typeof SettingKeys)[keyof typeof SettingKeys];

export const PaymentPolicies = {
  /** Booking confirmed immediately; payment collected after service. */
  PAY_AFTER_SERVICE: 'PAY_AFTER_SERVICE',
  /** Booking confirmed only after a verified payment. */
  PREPAID_REQUIRED: 'PREPAID_REQUIRED',
} as const;

export const DEFAULT_SETTINGS: Record<SettingKey, Record<string, unknown>> = {
  company: {
    name: 'Local Air Solutions',
    tagline: 'Cool Comfort Care',
    legalName: 'Local Air Solutions',
    email: '',
    phone: '',
    website: '',
    address: '',
    gstin: '',
    stateCode: '',
    logoUrl: '/brand/logo.png',
    supportPhone: '',
    supportWhatsapp: '',
  },
  general: {
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    dateFormat: 'dd MMM yyyy',
    allowCustomerCancellationHours: 4,
    requireCompletionOtp: false,
    technicianCanReject: true,
    showTechnicianPhoneToCustomer: true,
  },
  gst: {
    enabled: true,
    defaultRate: 18,
    pricesIncludeGst: false,
    sacCode: '998719',
  },
  payment: {
    policy: PaymentPolicies.PAY_AFTER_SERVICE,
    upiEnabled: true,
    upiId: '',
    upiPayeeName: 'Local Air Solutions',
    razorpayEnabled: false,
    cashEnabled: true,
  },
  reminder: {
    enabled: true,
    defaultIntervalMonths: 6,
    daysBeforeDue: 7,
    amcExpiryNoticeDays: 30,
  },
  notification: {
    inApp: true,
    push: true,
    email: false,
    whatsapp: false,
  },
  whatsapp: {
    manualSharingEnabled: true,
    cloudApiEnabled: false,
    businessNumber: '',
  },
  email: {
    sendBookingUpdates: true,
    sendInvoices: true,
    sendReminders: true,
  },
  appHome: {
    bannerEnabled: true,
    bannerTitle: 'Summer-ready AC',
    bannerSubtitle: 'Deep cleaning & servicing for better cooling and lower bills',
    bannerButtonText: 'Book now',
    announcement: '',
  },
  workingHours: {
    workingDays: [1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '19:00',
    slotDurationMinutes: 120,
    maxJobsPerSlot: 3,
  },
};
