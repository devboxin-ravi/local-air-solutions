/**
 * OpenAPI 3 document served at /api/docs. Endpoint catalogue is declared compactly;
 * request bodies are validated by Zod schemas in src/validations (see docs/API_DOCUMENTATION.md).
 */

import { config } from '../config';
import { API_PREFIX } from '../constants';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Row = [Method, string, string, string, boolean?];

const ENDPOINTS: Row[] = [
  ['post', '/auth/admin/login', 'Auth', 'Admin panel login', false],
  ['post', '/auth/login', 'Auth', 'Mobile app login (customer / technician)', false],
  ['post', '/auth/otp/verify', 'Auth', 'Verify login OTP', false],
  ['post', '/auth/register', 'Auth', 'Customer self-registration', false],
  ['post', '/auth/refresh', 'Auth', 'Rotate refresh token', false],
  ['post', '/auth/forgot-password', 'Auth', 'Send password-reset OTP', false],
  ['post', '/auth/reset-password', 'Auth', 'Reset password with OTP', false],
  ['post', '/auth/logout', 'Auth', 'Revoke refresh token', false],
  ['post', '/auth/logout-all', 'Auth', 'Revoke all sessions'],
  ['get', '/auth/me', 'Auth', 'Current user with roles & permissions'],
  ['get', '/auth/sessions', 'Auth', 'Active sessions'],
  ['post', '/auth/change-password', 'Auth', 'Change password'],
  ['post', '/auth/devices', 'Auth', 'Register FCM device token'],

  ['get', '/settings/public', 'Catalogue', 'Public branding & payment options', false],
  ['get', '/categories', 'Catalogue', 'List service categories', false],
  ['post', '/categories', 'Catalogue', 'Create category'],
  ['put', '/categories/reorder', 'Catalogue', 'Reorder categories'],
  ['patch', '/categories/{id}', 'Catalogue', 'Update category'],
  ['delete', '/categories/{id}', 'Catalogue', 'Delete unused category'],
  ['get', '/services', 'Catalogue', 'List services (paginated, filterable)', false],
  ['get', '/services/{id}', 'Catalogue', 'Service detail', false],
  ['post', '/services', 'Catalogue', 'Create service'],
  ['put', '/services/reorder', 'Catalogue', 'Reorder services'],
  ['patch', '/services/{id}', 'Catalogue', 'Update service (price history kept)'],
  ['patch', '/services/{id}/active', 'Catalogue', 'Activate / deactivate'],
  ['delete', '/services/{id}', 'Catalogue', 'Delete never-used service'],
  ['get', '/services/{id}/pricing', 'Catalogue', 'Price history & branch overrides'],
  ['post', '/services/{id}/pricing', 'Catalogue', 'Set base or branch price'],

  ['get', '/states', 'Master Data', 'List states', false],
  ['get', '/cities', 'Master Data', 'List cities', false],
  ['get', '/branches', 'Master Data', 'List branches', false],
  ['get', '/service-areas', 'Master Data', 'List service areas'],
  ['get', '/skills', 'Master Data', 'List skills'],
  ['get', '/products', 'Master Data', 'List product types', false],

  ['get', '/customers', 'Customers', 'List customers'],
  ['post', '/customers', 'Customers', 'Create customer (duplicate-mobile aware)'],
  ['get', '/customers/check-mobile', 'Customers', 'Find customers sharing a mobile'],
  ['get', '/customers/addresses', 'Customers', 'All customer addresses'],
  ['get', '/customers/{id}', 'Customers', 'Customer profile'],
  ['patch', '/customers/{id}', 'Customers', 'Update customer'],
  ['delete', '/customers/{id}', 'Customers', 'Soft-delete customer'],
  ['post', '/customers/{id}/addresses', 'Customers', 'Add address'],
  ['get', '/customers/{id}/ledger', 'Finance', 'Customer ledger statement'],

  ['get', '/staff', 'Staff', 'List staff / technicians'],
  ['post', '/staff', 'Staff', 'Create staff with login'],
  ['get', '/staff/{id}', 'Staff', 'Staff detail'],
  ['patch', '/staff/{id}', 'Staff', 'Update staff'],
  ['get', '/staff/{id}/history', 'Staff', 'Work history'],
  ['get', '/roles', 'Roles', 'List roles'],
  ['get', '/permissions', 'Roles', 'List permissions'],
  ['post', '/roles', 'Roles', 'Create custom role'],
  ['patch', '/roles/{id}', 'Roles', 'Update role permissions'],

  ['get', '/slots', 'Scheduling', 'List slots'],
  ['get', '/slots/available', 'Scheduling', 'Available slots for branch/date', false],
  ['post', '/slots/generate', 'Scheduling', 'Generate slots from working hours'],
  ['patch', '/slots/{id}', 'Scheduling', 'Update capacity / active'],

  ['get', '/bookings', 'Bookings', 'List bookings'],
  ['post', '/bookings', 'Bookings', 'Create booking (admin)'],
  ['get', '/bookings/calendar', 'Bookings', 'Calendar feed'],
  ['get', '/bookings/{id}', 'Bookings', 'Booking detail with history'],
  ['patch', '/bookings/{id}', 'Bookings', 'Edit booking'],
  ['post', '/bookings/{id}/status', 'Bookings', 'Validated status transition'],
  ['post', '/bookings/{id}/cancel', 'Bookings', 'Cancel (releases slot)'],
  ['post', '/bookings/{id}/reschedule', 'Bookings', 'Reschedule'],
  ['post', '/bookings/{id}/notes', 'Bookings', 'Add note'],
  ['post', '/bookings/{id}/attachments', 'Bookings', 'Upload files'],
  ['get', '/bookings/{id}/suggestions', 'Assignments', 'Suggested technicians'],
  ['post', '/bookings/{id}/assign', 'Assignments', 'Assign technician'],
  ['post', '/bookings/{id}/unassign', 'Assignments', 'Unassign technician'],
  ['get', '/assignments', 'Assignments', 'List assignments'],
  ['get', '/assignments/availability', 'Assignments', 'Technician availability board'],

  ['get', '/invoices', 'Finance', 'List invoices'],
  ['post', '/invoices/preview', 'Finance', 'Preview GST totals'],
  ['post', '/invoices/from-booking', 'Finance', 'Invoice a completed booking'],
  ['post', '/invoices', 'Finance', 'Manual invoice'],
  ['post', '/invoices/share', 'Finance', 'Bulk email / WhatsApp share'],
  ['get', '/invoices/{id}', 'Finance', 'Invoice detail'],
  ['get', '/invoices/{id}/pdf', 'Finance', 'Invoice PDF'],
  ['post', '/invoices/{id}/cancel', 'Finance', 'Cancel via ledger reversal'],
  ['get', '/payments', 'Finance', 'List payments'],
  ['post', '/payments', 'Finance', 'Record payment (Idempotency-Key supported)'],
  ['post', '/payments/{id}/verify', 'Finance', 'Approve / reject UPI payment'],
  ['post', '/payments/{id}/refund', 'Finance', 'Refund'],
  ['post', '/payments/razorpay/webhook', 'Finance', 'Razorpay webhook (signature verified)', false],
  ['post', '/ledger/adjustments', 'Finance', 'Ledger adjustment / opening balance'],
  ['get', '/ledger/outstanding', 'Finance', 'Customers with outstanding balance'],
  ['get', '/finance/summary', 'Finance', 'Finance dashboard'],

  ['get', '/amc', 'AMC', 'List contracts'],
  ['post', '/amc', 'AMC', 'Create contract (draft)'],
  ['get', '/amc/{id}', 'AMC', 'Contract detail'],
  ['patch', '/amc/{id}', 'AMC', 'Edit draft'],
  ['post', '/amc/{id}/invoice', 'AMC', 'Issue AMC invoice'],
  ['post', '/amc/{id}/activate', 'AMC', 'Activate & schedule visits'],
  ['post', '/amc/{id}/cancel', 'AMC', 'Cancel contract'],
  ['get', '/amc/visits', 'AMC', 'List visits'],
  ['post', '/amc/visits/{id}/book', 'AMC', 'Book a visit (linked booking)'],

  ['get', '/reminders', 'Reminders', 'List reminders by bucket'],
  ['get', '/reminders/summary', 'Reminders', 'Upcoming / due / overdue counts'],
  ['post', '/reminders', 'Reminders', 'Create reminder'],
  ['patch', '/reminders/{id}', 'Reminders', 'Update reminder'],
  ['get', '/notifications', 'Notifications', 'My notifications'],
  ['post', '/notifications/read', 'Notifications', 'Mark read'],
  ['get', '/settings', 'Settings', 'All settings + integration status'],
  ['put', '/settings/{key}', 'Settings', 'Update a settings group'],
  ['get', '/notification-templates', 'Settings', 'Templates'],
  ['get', '/audit-logs', 'Settings', 'Audit logs'],
  ['get', '/share/whatsapp', 'Sharing', 'wa.me link for booking/assignment/invoice/reminder'],
  ['get', '/dashboard', 'Reports', 'Dashboard KPIs & charts'],
  ['get', '/search', 'Reports', 'Global search'],
  ['get', '/reports/{key}', 'Reports', 'Report (format=json|csv|xlsx|pdf)'],

  ['get', '/me/home', 'Customer App', 'Home summary'],
  ['get', '/me/profile', 'Customer App', 'Profile'],
  ['get', '/me/addresses', 'Customer App', 'Addresses'],
  ['post', '/me/addresses', 'Customer App', 'Add address'],
  ['get', '/me/bookings', 'Customer App', 'My bookings'],
  ['post', '/me/bookings', 'Customer App', 'Book service / repair'],
  ['get', '/me/bookings/{id}', 'Customer App', 'Track booking'],
  ['post', '/me/bookings/{id}/cancel', 'Customer App', 'Cancel booking'],
  ['get', '/me/invoices', 'Customer App', 'My invoices'],
  ['get', '/me/payments', 'Customer App', 'My payments'],
  ['post', '/me/payments/upi', 'Customer App', 'Submit UPI reference (+ screenshot)'],
  ['post', '/me/payments/razorpay/order', 'Customer App', 'Create Razorpay order'],
  ['post', '/me/payments/razorpay/verify', 'Customer App', 'Verify Razorpay checkout'],
  ['get', '/me/amc', 'Customer App', 'My AMC contracts'],
  ['get', '/me/reminders', 'Customer App', 'My service reminders'],

  ['get', '/technician/dashboard', 'Technician App', 'Job counters'],
  ['get', '/technician/jobs', 'Technician App', 'Jobs by scope (today/upcoming/active/history)'],
  ['get', '/technician/jobs/{id}', 'Technician App', 'Job detail'],
  ['post', '/technician/jobs/{id}/respond', 'Technician App', 'Accept / reject'],
  ['post', '/technician/jobs/{id}/status', 'Technician App', 'On the way / arrived / start'],
  ['post', '/technician/jobs/{id}/complete', 'Technician App', 'Complete job (OTP if configured)'],
  ['post', '/technician/jobs/{id}/notes', 'Technician App', 'Add job note'],
  ['post', '/technician/jobs/{id}/photos', 'Technician App', 'Upload before/after photos'],
];

const envelope = {
  type: 'object',
  properties: { success: { type: 'boolean' }, data: {}, meta: { type: 'object' } },
};

const paths: Record<string, Record<string, unknown>> = {};
for (const [method, path, tag, summary, secured = true] of ENDPOINTS) {
  const params = Array.from(path.matchAll(/\{(\w+)\}/g)).map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: m[1] === 'key' ? 'string' : 'integer' } }));
  paths[path] = paths[path] ?? {};
  paths[path][method] = {
    tags: [tag],
    summary,
    ...(params.length ? { parameters: params } : {}),
    ...(['post', 'put', 'patch'].includes(method) ? { requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } } : {}),
    ...(secured ? { security: [{ bearerAuth: [] }] } : {}),
    responses: {
      200: { description: 'Success', content: { 'application/json': { schema: envelope } } },
      401: { description: 'Unauthenticated' },
      403: { description: 'Forbidden (permission / branch)' },
      422: { description: 'Validation error' },
    },
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: { title: config.appName, version: config.appVersion, description: 'Local Air Solutions — HVAC Service Management ERP API' },
  servers: [{ url: `${config.publicBaseUrl}${API_PREFIX}` }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths,
};
