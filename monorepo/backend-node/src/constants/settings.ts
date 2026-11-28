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
  BOOKING_TRACKER: 'bookingTracker',
} as const;
export type SettingKey = (typeof SettingKeys)[keyof typeof SettingKeys];

export const PaymentPolicies = {
  /** Booking confirmed immediately; payment collected after service. */
  PAY_AFTER_SERVICE: 'PAY_AFTER_SERVICE',
  /** Booking confirmed only after a verified payment. */
  PREPAID_REQUIRED: 'PREPAID_REQUIRED',
} as const;

/** Where a home promo banner's button leads in the customer app. */
export const PROMO_ACTIONS = ['SERVICES', 'BOOK', 'REPAIR', 'AMC'] as const;
/** Colour presets for home promo banners (each maps to an illustration in the app). */
export const PROMO_STYLES = ['GREEN', 'BLUE', 'ORANGE'] as const;
export const AppContentLimits = {
  MAX_SLIDES: 5,
  TAG_MAX: 24,
  TITLE_MAX: 60,
  SUBTITLE_MAX: 160,
  BUTTON_MAX: 24,
  ANNOUNCEMENT_MAX: 160,
  TRUST_POINTS: 3,
  TRUST_MAX: 28,
  ONBOARDING_PAGES: 3,
  ONBOARDING_TITLE_MAX: 40,
  ONBOARDING_TEXT_MAX: 140,
} as const;

/** Booking statuses shown as steps in the customer app's tracker, in order. */
export const TRACKER_STEP_STATUSES = ['CONFIRMED', 'ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'] as const;
/** First and last steps can't be hidden — the tracker always starts and ends with them. */
export const TRACKER_REQUIRED_STEPS: readonly string[] = ['CONFIRMED', 'COMPLETED'];
export const TrackerLimits = { LABEL_MAX: 14, TITLE_MAX: 40, HINT_MAX: 80 } as const;

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
    upiAccountName: '',
    upiId2: '',
    upiPayeeName2: '',
    upiAccountName2: '',
    defaultUpiAccount: 1,
    upiChargePercent: 0,
    razorpayChargePercent: 0,
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
    announcement: '',
    slides: [
      { enabled: true, tag: 'Featured Service', title: 'Summer-ready AC', subtitle: 'Deep cleaning & servicing for better cooling and lower bills', buttonText: 'Book now', action: 'SERVICES', style: 'GREEN' },
      { enabled: true, tag: 'AMC Plans', title: 'Year-round AC Care Plan', subtitle: 'Scheduled visits and priority support with an AMC.', buttonText: 'View plans', action: 'AMC', style: 'BLUE' },
      { enabled: true, tag: 'Quick Repair', title: 'Quick AC Repair', subtitle: 'AC not cooling? A trained expert can visit today.', buttonText: 'Book repair', action: 'REPAIR', style: 'ORANGE' },
    ],
    trustPoints: ['Trained technicians', 'Clear pricing', 'GST invoices'],
    todayCard: { enabled: true, title: 'Need a Service Today?', subtitle: 'Quick booking • Trusted experts • At your doorstep', buttonText: 'Book Now' },
    showCategories: true,
    showPopular: true,
    showTrustPoints: true,
    onboarding: [
      { title: 'Expert AC care at home', text: 'Installation, servicing, gas refilling and repairs by trained technicians.' },
      { title: 'Book in under a minute', text: 'Pick a service, choose a slot and track your technician live.' },
      { title: 'Transparent & protected', text: 'Clear pricing, GST invoices, AMC plans and timely service reminders.' },
    ],
  },
  bookingTracker: {
    steps: [
      { status: 'CONFIRMED', visible: true, label: 'Confirmed', title: 'Booking confirmed', hint: 'Your slot is reserved' },
      { status: 'ASSIGNED', visible: true, label: 'Assigned', title: 'Technician assigned', hint: 'An expert is matched to your job' },
      { status: 'ON_THE_WAY', visible: true, label: 'On the way', title: 'On the way', hint: 'Technician is heading to you' },
      { status: 'ARRIVED', visible: true, label: 'Arrived', title: 'Arrived', hint: 'Technician has reached your place' },
      { status: 'IN_PROGRESS', visible: true, label: 'Working', title: 'Work started', hint: 'Service is underway' },
      { status: 'COMPLETED', visible: true, label: 'Done', title: 'Completed', hint: 'Job done — invoice & warranty ready' },
    ],
  },
  workingHours: {
    workingDays: [1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '19:00',
    slotDurationMinutes: 120,
    maxJobsPerSlot: 3,
  },
};

/** The company can collect into two UPI IDs (separate bank accounts). */
/** Where verified cash goes. */
export const CASH_IN_HAND = 'Cash in hand';

export const UPI_ACCOUNT_KEYS = [1, 2] as const;
export const MAX_PAYMENT_CHARGE_PERCENT = 10;
