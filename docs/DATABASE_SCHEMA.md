# Database Schema (MySQL 8 · Prisma)

Source of truth: `monorepo/backend-node/prisma/schema.prisma`. Migrations: `prisma/migrations/`.

Conventions: `snake_case` tables/columns, `INT AUTO_INCREMENT` PKs, `DECIMAL(12,2)` for money, `created_at/updated_at` on mutable tables, soft delete (`deleted_at`) for users/customers, foreign keys everywhere, append-only financial history.

## Tables by domain

**Identity & access** — `users`, `roles`, `permissions` (`module.action` codes), `role_permissions`, `user_roles`, `refresh_tokens` (hashed, family-based rotation & reuse detection), `otp_codes` (hashed), `device_tokens`.

**Master data** — `states`, `cities`, `branches`, `service_areas` (PIN codes → branch), `skills`, `products`.

**Staff** — `staff_profiles` (1:1 user, branch, shift, availability), `technician_skills`, `staff_service_areas`.

**Customers** — `customers` (code `CUS00001`, optional 1:1 login user, branch, per-customer reminder interval), `customer_addresses` (verified lat/lng optional, service area auto-mapped from PIN).

**Catalogue** — `service_categories`, `services` (unique code, pricing type FIXED/STARTING/QUOTATION/FREE, GST, reminder settings), `service_skills`, `service_branches` (empty = all branches), `service_pricing` (effective-dated history incl. branch overrides).

**Scheduling & jobs** — `appointment_slots` (unique branch+date+start, `capacity`/`booked_count`), `slot_bookings`, `service_bookings` (number `LAS-YYYY-NNNNNN`, status, address snapshot JSON, completion OTP hash), `booking_items` (price snapshot), `booking_status_history`, `technician_assignments` (`is_current`), `job_notes`, `job_attachments`.

**Finance** — `invoices` (`INV-YYYY-NNNNNN`, GST split, snapshot JSON of company/customer at issue time), `invoice_items`, `payments` (`PAY-…`, unique `(method, reference)`, unique idempotency key), `payment_gateway_transactions` (Razorpay orders), `customer_ledger` (append-only with `balance_after`).

**AMC** — `amc_contracts` (`AMC-YYYY-NNNNNN`), `amc_contract_services`, `amc_visits` (unique contract+visit no.; booking links back via `service_bookings.amc_visit_id`).

**Engagement** — `service_reminders` (unique booking+service), `notifications` (unique `dedupe_key`, attempts for retry), `notification_templates` (event × channel), `company_settings` (JSON groups), `sequences` (document numbers), `audit_logs`.

## Concurrency & integrity
- **Slots:** `UPDATE … SET booked_count = booked_count + 1 WHERE id = ? AND booked_count < capacity` — a single atomic statement; the last seat cannot be sold twice.
- **Document numbers:** `INSERT … ON DUPLICATE KEY UPDATE value = value + 1` inside the creating transaction (row lock serialises callers).
- **Status changes / invoices / payments:** `SELECT … FOR UPDATE` on the booking/invoice/payment row inside an interactive transaction.
- **Ledger:** customer row locked before computing `balance_after`; corrections are `REVERSAL`/`ADJUSTMENT` entries, never updates or deletes.
- **Prices:** booking items and invoices store price/name snapshots, so catalogue changes never rewrite history.

## Key indexes
Bookings by `(branch_id, status)`, `customer_id`, `scheduled_date`, `created_at`; invoices by `(branch_id, invoice_date)`, `status`; ledger by `(customer_id, id)`; reminders by `(due_date, status)`; notifications by `(user_id, channel, status)`; audit by `(entity_type, entity_id)`.

## Backup & recovery
Nightly `mysqldump --single-transaction --routines --triggers local_air_solutions | gzip`, 30-day retention, weekly off-site copy, quarterly restore drill (see DEPLOYMENT_GUIDE.md).
