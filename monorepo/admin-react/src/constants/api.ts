/**
 * API endpoint paths (relative to config.apiBaseUrl) and HTTP constants.
 */

export const API = {
  AUTH: {
    LOGIN: '/auth/admin/login',
    OTP_VERIFY: '/auth/otp/verify',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    FORGOT: '/auth/forgot-password',
    RESET: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  DASHBOARD: '/dashboard',
  SEARCH: '/search',
  SETTINGS: '/settings',
  SETTING: (key: string) => `/settings/${key}`,
  PUBLIC_SETTINGS: '/settings/public',
  TEMPLATES: '/notification-templates',
  TEMPLATE: (id: number) => `/notification-templates/${id}`,
  AUDIT_LOGS: '/audit-logs',
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_READ: '/notifications/read',

  STATES: '/states',
  CITIES: '/cities',
  BRANCHES: '/branches',
  SERVICE_AREAS: '/service-areas',
  SKILLS: '/skills',
  PRODUCTS: '/products',
  MASTER: (resource: string, id?: number) => (id ? `/${resource}/${id}` : `/${resource}`),

  CATEGORIES: '/categories',
  CATEGORY: (id: number) => `/categories/${id}`,
  CATEGORIES_REORDER: '/categories/reorder',
  SERVICES: '/services',
  SERVICE: (id: number) => `/services/${id}`,
  SERVICE_ACTIVE: (id: number) => `/services/${id}/active`,
  SERVICE_PRICING: (id: number) => `/services/${id}/pricing`,

  CUSTOMERS: '/customers',
  CUSTOMER: (id: number) => `/customers/${id}`,
  CUSTOMER_CHECK_MOBILE: '/customers/check-mobile',
  CUSTOMER_ADDRESSES_ALL: '/customers/addresses',
  CUSTOMER_ADDRESSES: (id: number) => `/customers/${id}/addresses`,
  CUSTOMER_ADDRESS: (id: number, addressId: number) => `/customers/${id}/addresses/${addressId}`,
  CUSTOMER_LEDGER: (id: number) => `/customers/${id}/ledger`,

  STAFF: '/staff',
  STAFF_ONE: (id: number) => `/staff/${id}`,
  STAFF_HISTORY: (id: number) => `/staff/${id}/history`,
  ROLES: '/roles',
  ROLE: (id: number) => `/roles/${id}`,
  PERMISSIONS: '/permissions',

  SLOTS: '/slots',
  SLOT: (id: number) => `/slots/${id}`,
  SLOTS_GENERATE: '/slots/generate',
  SLOTS_AVAILABLE: '/slots/available',

  BOOKINGS: '/bookings',
  BOOKING: (id: number) => `/bookings/${id}`,
  BOOKINGS_CALENDAR: '/bookings/calendar',
  BOOKING_STATUS: (id: number) => `/bookings/${id}/status`,
  BOOKING_CANCEL: (id: number) => `/bookings/${id}/cancel`,
  BOOKING_RESCHEDULE: (id: number) => `/bookings/${id}/reschedule`,
  BOOKING_NOTES: (id: number) => `/bookings/${id}/notes`,
  BOOKING_ATTACHMENTS: (id: number) => `/bookings/${id}/attachments`,
  BOOKING_SUGGESTIONS: (id: number) => `/bookings/${id}/suggestions`,
  BOOKING_ASSIGN: (id: number) => `/bookings/${id}/assign`,
  BOOKING_UNASSIGN: (id: number) => `/bookings/${id}/unassign`,
  ASSIGNMENTS: '/assignments',
  AVAILABILITY: '/assignments/availability',

  INVOICES: '/invoices',
  INVOICE: (id: number) => `/invoices/${id}`,
  INVOICE_PDF: (id: number) => `/invoices/${id}/pdf`,
  INVOICE_PREVIEW: '/invoices/preview',
  INVOICE_FROM_BOOKING: '/invoices/from-booking',
  INVOICE_CANCEL: (id: number) => `/invoices/${id}/cancel`,
  INVOICE_SHARE: '/invoices/share',
  PAYMENTS: '/payments',
  PAYMENT_VERIFY: (id: number) => `/payments/${id}/verify`,
  PAYMENT_REFUND: (id: number) => `/payments/${id}/refund`,
  LEDGER_ADJUST: '/ledger/adjustments',
  OUTSTANDING: '/ledger/outstanding',
  FINANCE_SUMMARY: '/finance/summary',

  AMC: '/amc',
  AMC_ONE: (id: number) => `/amc/${id}`,
  AMC_INVOICE: (id: number) => `/amc/${id}/invoice`,
  AMC_ACTIVATE: (id: number) => `/amc/${id}/activate`,
  AMC_CANCEL: (id: number) => `/amc/${id}/cancel`,
  AMC_VISITS: '/amc/visits',
  AMC_VISIT_BOOK: (id: number) => `/amc/visits/${id}/book`,

  REMINDERS: '/reminders',
  REMINDER: (id: number) => `/reminders/${id}`,
  REMINDER_SUMMARY: '/reminders/summary',

  REPORT: (key: string) => `/reports/${key}`,
  SHARE_WHATSAPP: '/share/whatsapp',
} as const;

export const HTTP = {
  TIMEOUT_MS: 20_000,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  IDEMPOTENCY_HEADER: 'Idempotency-Key',
} as const;

export const QUERY = {
  STALE_MS: 30_000,
  NOTIFICATION_POLL_MS: 60_000,
  DEFAULT_PAGE_SIZE: 20,
  LOOKUP_PAGE_SIZE: 100,
} as const;

export const STORAGE_KEYS = {
  REFRESH_TOKEN: 'las.admin.rt',
  BRANCH: 'las.admin.branch',
} as const;
