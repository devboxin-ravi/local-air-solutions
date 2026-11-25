/**
 * UI constants: date formats, status labels/tones, validation limits, select options.
 */

export const LOCALE = 'en-IN';

/** Shared page container: header, page content and footer use the same width and side padding. */
export const PAGE_CONTAINER = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6';

export const DATE_FORMATS = {
  DISPLAY: 'dd MMM yyyy',
  DISPLAY_TIME: 'dd MMM yyyy, hh:mm a',
  ISO_DATE: 'yyyy-MM-dd',
  MONTH: 'MMM yyyy',
  /** Chart axis labels. */
  MONTH_SHORT: "MMM ''yy",
  DAY_SHORT: 'dd MMM',
  DAY_OF_MONTH: 'dd',
  MONTH_ABBR: 'MMM',
  WEEKDAY_SHORT: 'EEE',
} as const;

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';

export const BOOKING_STATUS_TONE: Record<string, Tone> = {
  PENDING_PAYMENT: 'amber',
  PAYMENT_VERIFICATION: 'amber',
  CONFIRMED: 'blue',
  ASSIGNED: 'violet',
  ACCEPTED: 'violet',
  ON_THE_WAY: 'cyan',
  ARRIVED: 'cyan',
  IN_PROGRESS: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  REJECTED: 'red',
  RESCHEDULED: 'amber',
};

export const BOOKING_STATUSES = Object.keys(BOOKING_STATUS_TONE);

/** Manual status moves offered in the admin UI (the API validates every transition). */
export const ADMIN_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'REJECTED'],
  PAYMENT_VERIFICATION: ['CONFIRMED', 'PENDING_PAYMENT', 'REJECTED'],
  CONFIRMED: [],
  ASSIGNED: ['ACCEPTED'],
  ACCEPTED: ['ON_THE_WAY'],
  ON_THE_WAY: ['ARRIVED'],
  ARRIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  RESCHEDULED: ['CONFIRMED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export const CANCELLABLE_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_VERIFICATION', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'RESCHEDULED'];
export const ASSIGNABLE_STATUSES = ['CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'RESCHEDULED'];
export const RESCHEDULABLE_STATUSES = ['CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'];

export const GENERIC_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'green',
  INACTIVE: 'neutral',
  SUSPENDED: 'red',
  DRAFT: 'neutral',
  ISSUED: 'blue',
  PARTIALLY_PAID: 'amber',
  PAID: 'green',
  UNPAID: 'amber',
  CANCELLED: 'red',
  PENDING_VERIFICATION: 'amber',
  VERIFIED: 'green',
  REJECTED: 'red',
  REFUNDED: 'violet',
  FAILED: 'red',
  PENDING_PAYMENT: 'amber',
  EXPIRING: 'amber',
  EXPIRED: 'neutral',
  SCHEDULED: 'blue',
  BOOKED: 'violet',
  COMPLETED: 'green',
  MISSED: 'red',
  UPCOMING: 'blue',
  DUE: 'amber',
  OVERDUE: 'red',
  DISMISSED: 'neutral',
  ASSIGNED: 'violet',
  ACCEPTED: 'cyan',
  ...BOOKING_STATUS_TONE,
};

export const PRICING_TYPES = [
  { value: 'FIXED', label: 'Fixed price' },
  { value: 'STARTING', label: 'Starting from' },
  { value: 'QUOTATION', label: 'Custom quotation' },
  { value: 'FREE', label: 'Free service' },
] as const;

/** One-line explanations shown on the pricing-type cards in the service form. */
export const PRICING_TYPE_HINTS: Record<string, string> = {
  FIXED: 'Exact price shown and charged',
  STARTING: 'Shown as “From ₹…”, final after inspection',
  QUOTATION: 'No price shown — quoted on site',
  FREE: 'No charge (e.g. inspection visit)',
};

/** Quick-pick job durations (minutes) in the service form. */
export const DURATION_PRESETS = [30, 60, 90, 120, 180, 240] as const;

/** Uppercase service-code length limit (mirrors backend). */
export const SERVICE_CODE_MAX = 30;

export const PAYMENT_METHODS = [
  { value: 'UPI_MANUAL', label: 'UPI (manual)' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'RAZORPAY', label: 'Razorpay' },
] as const;

/** Customer-app content editor (mirrors backend AppContentLimits / PROMO_*). */
export const APP_CONTENT = {
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
  ACTIONS: [
    { value: 'SERVICES', label: 'Open all services' },
    { value: 'BOOK', label: 'Start a service booking' },
    { value: 'REPAIR', label: 'Start a repair booking' },
    { value: 'AMC', label: 'Open AMC plans' },
  ],
  /** Banner colour presets; `from`/`to` mirror the app's gradient, `accent` its title colour. */
  STYLES: [
    { value: 'GREEN', label: 'Green', from: '#E4F0D6', to: '#F1F6EC', accent: '#5E8F27' },
    { value: 'BLUE', label: 'Blue', from: '#DDEBFC', to: '#FFFFFF', accent: '#0048A8' },
    { value: 'ORANGE', label: 'Orange', from: '#FFE9D6', to: '#FFFFFF', accent: '#EA580C' },
  ],
} as const;

/** Customer-app booking tracker steps (mirrors backend TRACKER_STEP_STATUSES). */
export const TRACKER = {
  STEPS: [
    { status: 'CONFIRMED', name: 'Booking confirmed' },
    { status: 'ASSIGNED', name: 'Technician assigned' },
    { status: 'ON_THE_WAY', name: 'Technician on the way' },
    { status: 'ARRIVED', name: 'Technician arrived' },
    { status: 'IN_PROGRESS', name: 'Work in progress' },
    { status: 'COMPLETED', name: 'Job completed' },
  ],
  /** Always shown — the tracker starts and ends with these. */
  REQUIRED: ['CONFIRMED', 'COMPLETED'],
  LABEL_MAX: 14,
  TITLE_MAX: 40,
  HINT_MAX: 80,
} as const;

/** Photo uploads (service / category images). Mirrors the backend allow-list and size limit. */
export const IMAGE_UPLOAD = {
  ACCEPT: 'image/jpeg,image/png,image/webp',
  MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_BYTES: 5 * 1024 * 1024,
} as const;

export const LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 100,
  EMAIL_MAX: 254,
  USERNAME_MAX: 30,
  ADDRESS_MIN: 5,
  ADDRESS_MAX: 500,
  DESCRIPTION_MAX: 2000,
  NOTES_MAX: 1000,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  CODE_MAX: 30,
  AMOUNT_MAX: 99_999_999.99,
  TEMPLATE_BODY_MAX: 5000,
  TEMPLATE_SUBJECT_MAX: 200,
  SLOT_DAYS_MAX: 60,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

export const PATTERNS = {
  MOBILE: /^[6-9]\d{9}$/,
  PINCODE: /^[1-9]\d{5}$/,
  /** Login username: starts with a letter; lowercase letters, digits, dot, underscore. */
  USERNAME: /^[a-z][a-z0-9._]{2,29}$/,
  TIME: /^([01]\d|2[0-3]):[0-5]\d$/,
  SERVICE_CODE: /^[A-Z0-9-]+$/,
  GSTIN: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  GST_STATE_CODE: /^\d{2}$/,
  SAC_CODE: /^\d{4,8}$/,
  UPI_ID: /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/,
  ROLE_CODE: /^[A-Z_]+$/,
  MASTER_CODE: /^[A-Z0-9-]+$/,
  PINCODE_LIST: /^\s*[1-9]\d{5}(\s*,\s*[1-9]\d{5})*\s*$/,
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d).+$/,
} as const;

export const MESSAGES = {
  MOBILE: 'Enter a valid 10-digit Indian mobile number',
  PINCODE: 'Enter a valid 6-digit PIN code',
  EMAIL: 'Enter a valid email',
  GSTIN: 'Enter a valid 15-character GSTIN',
  GST_STATE_CODE: 'Use the 2-digit GST state code, e.g. 22',
  SAC_CODE: 'SAC code is 4 to 8 digits',
  UPI_ID: 'Enter a valid UPI ID, e.g. name@bank',
  ROLE_CODE: 'Use UPPER_SNAKE_CASE letters only',
  MASTER_CODE: 'Use uppercase letters, numbers and hyphens',
  PINCODE_LIST: 'Comma-separated 6-digit PIN codes',
  URL: 'Enter a full URL, e.g. https://example.com',
  END_AFTER_START: 'Must be after the start',
  NUMBER: 'Enter a number',
  WHOLE_NUMBER: 'Enter a whole number',
  SELECT_ONE: 'Select at least one',
  FIX_ERRORS: 'Please fix the highlighted fields.',
  USERNAME: 'Username: 3-30 lowercase letters, numbers, dot or underscore, starting with a letter',
  PASSWORD: 'At least 8 characters with a letter and a number',
  REQUIRED: 'This field is required',
  SAVED: 'Saved successfully',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection.',
} as const;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CHART_COLORS = ['#0048A8', '#88C040', '#3F7CD8', '#F59E0B', '#0EA5E9', '#8B5CF6', '#EF4444', '#14B8A6', '#64748B'];

export const SETTING_SECTIONS: Record<string, { title: string; description: string }> = {
  company: { title: 'Company Profile', description: 'Business identity used on invoices, apps and notifications.' },
  general: { title: 'General Settings', description: 'Operational policies for bookings and field staff.' },
  gst: { title: 'GST Settings', description: 'Default tax configuration for invoices.' },
  payment: { title: 'Payment Settings', description: 'Payment policy and accepted methods.' },
  reminder: { title: 'Reminder Settings', description: 'Service and AMC reminder schedule.' },
  notification: { title: 'Notification Settings', description: 'Channels used for customer and staff notifications.' },
  whatsapp: { title: 'WhatsApp Integration', description: 'Manual wa.me sharing and WhatsApp Business Cloud API readiness.' },
  email: { title: 'Email Configuration', description: 'Which emails are sent through SMTP.' },
  workingHours: { title: 'Working Hours', description: 'Defaults used to generate appointment slots.' },
  appHome: { title: 'Customer App Content', description: 'Home banners, sections, “Need a service today” card and the welcome screens of the customer app.' },
  bookingTracker: { title: 'Booking Tracker', description: 'Steps, names and messages customers see while tracking a booking in the app.' },
};
