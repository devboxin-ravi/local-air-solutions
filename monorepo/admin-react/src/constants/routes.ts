/**
 * Route paths used by the router and navigation.
 */

export const ROUTES = {
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  DASHBOARD: '/dashboard',
  NOTIFICATIONS: '/notifications',
  PROFILE: '/profile',

  BOOKINGS: '/bookings',
  BOOKINGS_VIEW: (view: string) => `/bookings/view/${view}`,
  BOOKING_NEW: '/bookings/new',
  BOOKING_DETAIL: (id: number | string) => `/bookings/${id}`,
  BOOKING_CALENDAR: '/bookings/calendar',
  SLOTS: '/bookings/slots',

  SERVICES: '/services',
  SERVICE_NEW: '/services/new',
  SERVICE_EDIT: (id: number | string) => `/services/${id}/edit`,
  CATEGORIES: '/services/categories',
  PRICING: '/services/pricing',
  REPAIRS: '/services/repairs',
  AVAILABILITY: '/services/availability',

  ASSIGNMENTS: '/assignments',
  ASSIGN: '/assignments/assign',
  TECH_AVAILABILITY: '/assignments/availability',
  STAFF_SCHEDULE: '/assignments/schedule',
  JOB_TRACKING: '/assignments/tracking',
  COMPLETED_JOBS: '/assignments/completed',

  CUSTOMERS: '/customers',
  CUSTOMER_NEW: '/customers/new',
  CUSTOMER_DETAIL: (id: number | string) => `/customers/${id}`,
  CUSTOMER_ADDRESSES: '/customers/addresses',
  CUSTOMER_HISTORY: '/customers/history',
  CUSTOMER_LEDGER: '/customers/ledger',
  REMINDERS: '/customers/reminders',

  AMC: '/amc',
  AMC_NEW: '/amc/new',
  AMC_DETAIL: (id: number | string) => `/amc/${id}`,
  AMC_VISITS: '/amc/visits',
  AMC_EXPIRING: '/amc/expiring',
  AMC_REPORTS: '/amc/reports',

  INVOICES: '/finance/invoices',
  INVOICE_NEW: '/finance/invoices/new',
  INVOICE_DETAIL: (id: number | string) => `/finance/invoices/${id}`,
  PAYMENTS: '/finance/payments',
  PAYMENT_VERIFICATION: '/finance/verification',
  FINANCE_LEDGER: '/finance/ledger',
  OUTSTANDING: '/finance/outstanding',
  GST_REPORTS: '/finance/gst',

  REPORT: (key: string) => `/reports/${key}`,

  STATES: '/master/states',
  CITIES: '/master/cities',
  BRANCHES: '/master/branches',
  SERVICE_AREAS: '/master/service-areas',
  SKILLS_PRODUCTS: '/master/skills-products',
  STAFF: '/master/staff',
  ROLES: '/master/roles',

  SETTINGS: (key: string) => `/settings/${key}`,
  AUDIT_LOGS: '/settings/audit-logs',
  TEMPLATES: '/settings/templates',
} as const;

/** Booking list presets reachable from the Bookings dropdown. */
export const BOOKING_VIEWS: Record<string, { title: string; description: string; status?: string }> = {
  pending: { title: 'Pending Bookings', description: 'Awaiting payment, verification or technician assignment.', status: 'PENDING_PAYMENT,PAYMENT_VERIFICATION,CONFIRMED,RESCHEDULED' },
  confirmed: { title: 'Confirmed Bookings', description: 'Confirmed and in the field workflow.', status: 'CONFIRMED,ASSIGNED,ACCEPTED,ON_THE_WAY,ARRIVED,IN_PROGRESS' },
  completed: { title: 'Completed Bookings', description: 'Jobs finished by technicians.', status: 'COMPLETED' },
  cancelled: { title: 'Cancelled Bookings', description: 'Cancelled or rejected bookings.', status: 'CANCELLED,REJECTED' },
};
