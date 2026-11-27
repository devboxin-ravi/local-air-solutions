/**
 * UI constants: date formats, status labels/tones, validation limits, select options.
 */

export const LOCALE = 'en-IN';

/** Shared page container: header, page content and footer use the same width and side padding. */
export const PAGE_CONTAINER = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6';

/** Serial-number column shown as the first column of every admin table. */
export const SERIAL_COLUMN = {
  HEADER: 'S.No.',
  /** Applied to both the <th> and <td> so the column stays narrow and the numbers line up. */
  CLASS: 'w-16 whitespace-nowrap text-center',
  CELL_TEXT: 'num font-semibold text-slate-500',
} as const;

/** Short input placeholders: an example value or a hint of the expected format, never the label repeated. */
export const PLACEHOLDERS = {
  // People & contact
  FULL_NAME: 'e.g. Ravi Kumar',
  MOBILE: '10-digit mobile',
  EMAIL: 'name@example.com',
  USERNAME: 'e.g. ravi.k',
  LOGIN_ID: 'Email or mobile',
  DESIGNATION: 'e.g. Senior Technician',
  EXPERIENCE_YEARS: 'e.g. 5',
  // Passwords & codes
  PASSWORD: 'Enter password',
  CURRENT_PASSWORD: 'Current password',
  NEW_PASSWORD: 'Min 8 characters',
  CONFIRM_PASSWORD: 'Re-enter password',
  OTP: '6-digit code',
  // Address & location
  ADDRESS_LABEL: 'e.g. Home',
  PINCODE: '6-digit PIN',
  LANDMARK: 'e.g. Near City Mall',
  ADDRESS: 'Full address',
  AREA_NAME: 'e.g. Civil Lines',
  PINCODES: 'e.g. 492001, 492004',
  LATITUDE: 'e.g. 21.2514',
  LONGITUDE: 'e.g. 81.6296',
  RADIUS_KM: 'e.g. 10',
  STATE_CODE: 'e.g. CG',
  BRANCH_CODE: 'e.g. RPR-01',
  GST_STATE_CODE: 'e.g. 22',
  TIMEZONE: 'e.g. Asia/Kolkata',
  // Money & numbers
  AMOUNT: '0.00',
  QUANTITY: '1',
  MONTHS: 'e.g. 6',
  DAYS: 'e.g. 7',
  HOURS: 'e.g. 4',
  MINUTES: 'e.g. 60',
  CAPACITY: 'e.g. 3',
  VISITS: 'e.g. 4',
  SORT_ORDER: '0',
  SAC_CODE: 'e.g. 998719',
  // Free text
  NAME: 'Enter name',
  NOTE: 'Add a note…',
  REASON: 'Enter reason…',
  DESCRIPTION: 'Short description…',
  INTERNAL_NOTES: 'Visible to staff only…',
  TECHNICIAN_NOTES: 'Instructions for the technician…',
  INVOICE_NOTES: 'Printed on the invoice',
  PAYMENT_REFERENCE: 'UTR / transaction ID',
  RECEIPT_NO: 'Receipt no.',
  LEDGER_DESCRIPTION: 'e.g. Opening balance',
  PRODUCT_DETAILS: 'e.g. 2 × Split AC 1.5 Ton',
  CONTRACT_TERMS: 'Contract terms & conditions…',
  SERVICE_INCLUDES: 'e.g. Coil cleaning, gas check',
  BOOKING_INSTRUCTIONS: 'Gate code, parking, best time…',
  CATEGORY_NAME: 'e.g. AC Repairing',
  PRODUCT_CATEGORY: 'e.g. Air Conditioner',
  ICON_NAME: 'e.g. air-vent',
  ROLE_NAME: 'e.g. Accountant',
  ROLE_CODE: 'e.g. ACCOUNTANT',
  TEMPLATE_SUBJECT: 'e.g. Booking confirmed',
  TEMPLATE_BODY: 'Hi, your booking {{bookingNumber}}…',
  TRACKER_LABEL: 'e.g. On the way',
  TRACKER_TITLE: 'e.g. Technician is on the way',
  TRACKER_HINT: 'Short message for the customer',
  COMPANY_NAME: 'e.g. Local Air Solutions',
  LEGAL_NAME: 'Registered company name',
  TAGLINE: 'e.g. Cool Comfort Care',
  UPI_PAYEE: 'Name shown on UPI',
} as const;

/** Customer search field (bookings, invoices, AMC, ledger). */
export const CUSTOMER_PICKER = {
  PLACEHOLDER: 'Search customer by name, mobile or ID…',
  EMPTY_TEXT: 'No customers found.',
} as const;

/** Developer credit shown in the footer of every admin page. */
export const DEVELOPER_CREDIT = {
  PREFIX: 'Developed by -',
  NAME: 'DeveloperBox AI Factory',
} as const;

/** Roles & permissions grid. */
export const PERMISSION_MATRIX = {
  SELECT_ALL: 'Select all',
  ALL: 'All',
  MODULE: 'Module',
  UNSAVED: 'Unsaved changes',
  SELECTED: 'selected',
  READ_ONLY_SUPER: 'Super Admin always has full access — these permissions cannot be restricted.',
  READ_ONLY_NO_RIGHTS: 'You can view these permissions. Roles → Manage is needed to change them.',
  READ_ONLY_VIEW: 'Read-only view — use Edit to change permissions.',
  APP_ROLE_NOTE: 'Uses the mobile app — admin-panel permissions are not required.',
} as const;

/** Show/hide eye on password inputs. */
export const PASSWORD_TOGGLE = {
  SHOW: 'Show password',
  HIDE: 'Hide password',
} as const;

/** Payment settings: method cards and Razorpay keys dialog. */
export const PAYMENT_METHODS_UI = {
  SHOWN_IN_APP: 'Shown in app',
  HIDDEN_IN_APP: 'Hidden',
  UPI_DESCRIPTION: 'Customer pays to your UPI ID and shares the reference; staff verify it.',
  RAZORPAY_DESCRIPTION: 'Customer pays online in the app (cards, UPI, net banking). Confirmed automatically.',
  CASH_DESCRIPTION: 'Customer pays the technician after the job (cash or UPI on the spot).',
  RAZORPAY_NEEDS_KEYS: 'Add your Razorpay keys to turn this on.',
  RAZORPAY_ON_WITHOUT_KEYS: 'Razorpay is switched on but has no keys — the app will not show it until keys are added.',
  NONE_ENABLED: 'All payment methods are off — customers will not see any way to pay in the app.',
  NO_ENCRYPTION_KEY: 'The server has no SECRETS_ENCRYPTION_KEY, so keys cannot be saved from here. Ask the developer to add it to the backend .env and restart.',
  SECURITY_NOTE: 'The Key Secret and webhook secret are encrypted on the server and never shown again — not in this panel, not in the apps. Only the Key ID is shared with the app to open checkout.',
} as const;

/** Field layout of each integration's credentials dialog (secret fields are write-only). */
export interface IntegrationFieldDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'password' | 'textarea' | 'switch' | 'choice';
  /** Width on the 6-column grid (default 3 = half). */
  span?: 2 | 3 | 4 | 6;
  /** For type 'choice': the buttons; picking one can also fill other fields (e.g. the port). */
  options?: Array<{ value: boolean | string; label: string; patch?: Record<string, string> }>;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  secret?: boolean;
}
export const INTEGRATION_FORMS: Record<'smtp' | 'fcm' | 'whatsappCloud', { title: string; description: string; fields: IntegrationFieldDef[]; jsonImport?: { label: string; hint: string; map: Record<string, string> } }> = {
  smtp: {
    title: 'SMTP email',
    description: 'Sends invoices, OTPs and notifications by email. Gmail / Google Workspace: smtp.gmail.com, port 587, and an App Password.',
    fields: [
      { key: 'host', label: 'SMTP host', placeholder: 'smtp.gmail.com', required: true, span: 4 },
      { key: 'port', label: 'Port', type: 'number', placeholder: '587', required: true, span: 2 },
      {
        key: 'secure',
        label: 'Encryption',
        type: 'choice',
        span: 6,
        options: [
          { value: false, label: 'STARTTLS · port 587', patch: { port: '587' } },
          { value: true, label: 'SSL · port 465', patch: { port: '465' } },
        ],
      },
      { key: 'user', label: 'Username', placeholder: 'billing@yourcompany.com', required: true },
      { key: 'password', label: 'Password / app password', type: 'password', secret: true, required: true },
      { key: 'from', label: 'From address', placeholder: 'Local Air Solutions <billing@yourcompany.com>', required: true, span: 6, hint: 'Name and email customers see as the sender' },
    ],
  },
  fcm: {
    title: 'Firebase push (FCM)',
    description: 'Sends push notifications to the customer and technician apps. Firebase console → Project settings → Service accounts → Generate new private key.',
    jsonImport: {
      label: 'Paste service-account JSON (optional)',
      hint: 'Paste the whole downloaded .json file — the fields below fill in automatically.',
      map: { project_id: 'projectId', client_email: 'clientEmail', private_key: 'privateKey' },
    },
    fields: [
      { key: 'projectId', label: 'Project ID', placeholder: 'local-air-solutions', required: true, span: 2 },
      { key: 'clientEmail', label: 'Client email', placeholder: 'firebase-adminsdk-xxx@project.iam.gserviceaccount.com', required: true, span: 4 },
      { key: 'privateKey', label: 'Private key', type: 'textarea', secret: true, required: true, span: 6, placeholder: '-----BEGIN PRIVATE KEY-----' },
    ],
  },
  whatsappCloud: {
    title: 'WhatsApp Cloud API',
    description: 'Sends WhatsApp messages automatically. Meta for Developers → your app → WhatsApp → API Setup. Use a permanent (system user) token.',
    fields: [
      { key: 'phoneNumberId', label: 'Phone number ID', placeholder: '1234567890123', required: true, span: 6, hint: 'Digits only — not the phone number itself' },
      { key: 'accessToken', label: 'Access token', type: 'password', secret: true, required: true, span: 6 },
    ],
  },
};

/** Label of the back arrow on detail and form pages. */
export const BACK_LABEL = 'Back';

/** Row action buttons in list tables. */
export const ROW_ACTIONS = {
  HEADER: 'Actions',
  VIEW: 'View',
  EDIT: 'Edit',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  /** Shown in delete confirmations for records that are deactivated rather than erased. */
  DEACTIVATE_NOTE: 'It is marked Inactive and hidden from customers and new bookings. History is kept, and you can restore it any time with the Active switch.',
  ARCHIVE_NOTE: 'The record is archived (soft delete): it disappears from lists and pickers, but past bookings, invoices and the audit log stay intact.',
} as const;

/** Drag-to-resize table columns. */
export const COLUMN_RESIZE = {
  /** Narrowest a column can be dragged to (px). */
  MIN_WIDTH: 56,
  /** Pixels moved per arrow-key press on a focused resize handle. */
  KEY_STEP: 16,
  HANDLE_LABEL: 'Resize column (drag, or use arrow keys; double-click to reset)',
} as const;

/** Dropdowns with at least this many choices (placeholder excluded) get a type-to-search box. */
export const SEARCHABLE_SELECT = {
  MIN_OPTIONS: 8,
  /** Placeholder of the search box inside every dropdown / picker. */
  SEARCH_PLACEHOLDER: 'Search…',
  /** Trigger text when a dropdown has no value and no placeholder option. */
  SELECT_PLACEHOLDER: 'Select…',
  EMPTY_TEXT: 'No matches',
  LOADING_TEXT: 'Searching…',
} as const;

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
