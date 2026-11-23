# API Documentation

- Base URL: `{PUBLIC_BASE_URL}/api/v1`
- Interactive OpenAPI: `GET /api/docs` (Swagger UI)
- Auth: `Authorization: Bearer <accessToken>` (15 min). Refresh with `POST /auth/refresh` (rotating refresh token, 30 days; reuse revokes the whole session family).
- Envelope: success `{ "success": true, "data": …, "meta"?: { page, pageSize, total, totalPages } }`; error `{ "success": false, "error": { "code", "message", "details"? } }`.
- Validation errors: `422` with field `details`. Permission: `403`. Branch violations: `403 BRANCH_FORBIDDEN`.
- Lists: `page`, `pageSize` (≤100), `search`, `sortBy`, `sortOrder`, `branchId` + module filters.
- Idempotency: `Idempotency-Key` header on `POST /payments` and `POST /me/payments/upi`.

## Endpoint groups

| Group | Key endpoints |
|---|---|
| Auth | `POST /auth/admin/login` (admins only), `POST /auth/login` (app), `/auth/otp/verify`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me`, `/auth/change-password`, `/auth/devices` |
| Public | `GET /settings/public`, `/categories`, `/services`, `/services/:id`, `/states`, `/cities`, `/branches`, `/products`, `/slots/available?branchId&date` |
| Catalogue (admin) | CRUD `/categories`, `/services`, `PUT …/reorder`, `PATCH /services/:id/active`, `GET/POST /services/:id/pricing` |
| Master data | CRUD `/states`, `/cities`, `/branches`, `/service-areas`, `/skills`, `/products` |
| Customers | `/customers` CRUD, `/customers/check-mobile`, `/customers/addresses`, `/customers/:id/addresses`, `/customers/:id/ledger` |
| Staff & roles | `/staff` CRUD, `/staff/:id/history`, `/roles`, `/permissions` |
| Slots | `/slots`, `/slots/generate`, `PATCH/DELETE /slots/:id` |
| Bookings | `/bookings` list/create, `/bookings/calendar`, `/bookings/:id`, `/status`, `/cancel`, `/reschedule`, `/notes`, `/attachments` |
| Assignments | `/bookings/:id/suggestions`, `/assign`, `/unassign`, `/assignments`, `/assignments/availability` |
| Finance | `/invoices` (+ `/preview`, `/from-booking`, `/share`, `/:id/pdf`, `/:id/cancel`), `/payments` (+ `/:id/verify`, `/:id/refund`, `/razorpay/webhook`), `/ledger/adjustments`, `/ledger/outstanding`, `/finance/summary` |
| AMC | `/amc` CRUD, `/:id/invoice`, `/:id/activate`, `/:id/cancel`, `/amc/visits`, `/amc/visits/:id/book` |
| Engagement | `/reminders` (+ `/summary`), `/notifications` (+ `/read`), `/settings`, `/settings/:key`, `/notification-templates`, `/audit-logs`, `/share/whatsapp?type&id` |
| Reports | `/dashboard`, `/search?q=`, `/reports/:key?format=json|csv|xlsx|pdf` (bookings, revenue, services, staff, branches, customers, gst, payments, amc) |
| Customer app | `/me/home`, `/me/profile`, `/me/addresses`, `/me/bookings` (+ track, cancel, attachments), `/me/invoices`, `/me/payments`, `/me/payments/upi`, `/me/payments/razorpay/order|verify`, `/me/amc`, `/me/reminders`, `/me/ledger` |
| Technician app | `/technician/dashboard`, `/technician/jobs?scope=today|upcoming|active|history`, `/technician/jobs/:id` (+ `/respond`, `/status`, `/complete`, `/notes`, `/photos`) |

## Booking status machine
`PENDING_PAYMENT → PAYMENT_VERIFICATION → CONFIRMED → ASSIGNED → ACCEPTED → ON_THE_WAY → ARRIVED → IN_PROGRESS → COMPLETED`, plus `CANCELLED`, `REJECTED`, `RESCHEDULED`. Allowed moves: `backend-node/src/constants/domain.ts` (`BOOKING_TRANSITIONS`). Every change writes `booking_status_history` with actor and time.

## Permissions
Codes `module.action` (view/create/edit/delete/approve/export/assign/manage). Defaults per role in `src/constants/roles.ts`; editable in Admin → Master Data → Roles & Permissions. Super Admin bypasses checks; Company Admin is company-wide; Branch Manager is limited to their branch.
