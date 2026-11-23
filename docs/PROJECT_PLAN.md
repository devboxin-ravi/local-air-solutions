# Project Plan — Local Air Solutions HVAC Service ERP

## Scope
Single-company (not multi-tenant) service ERP: Company → State → City → Branch → Service Area.

Applications (one monorepo, existing layered structure kept):

| Path | Stack | Purpose |
|---|---|---|
| `monorepo/backend-node` | Node 20+, Express, TypeScript, Prisma, MySQL 8, Zod | REST API `/api/v1`, jobs, PDFs, exports |
| `monorepo/admin-react` | React 18, Vite, Tailwind, Radix (shadcn-style), TanStack Query, RHF + Zod, Recharts | Admin web panel (top navigation, no sidebar) |
| `monorepo/app-flutter` | Flutter 3, Riverpod 3, Dio, GoRouter, Secure Storage, Hive | One app, role-based: customer experience + technician field app |

## Architecture rules (from CLAUDE.md)
- Backend: routes → controllers (HTTP only) → services (business logic) → repositories (DB only). Composition root in `src/dependencies/register.ts`.
- Admin: routes (guards) → pages (composition) → components (UI) → hooks (logic/state) → services (API).
- Flutter: `features/*/{data,domain,presentation}`; HTTP only through `core/network/api_client.dart`; env only via `core/config/app_config.dart`.
- Env vars only through config layers; constants in `constants/`.

## Phases & status
| Phase | Content | Status |
|---|---|---|
| 1 Foundation | Schema, auth, RBAC, design tokens, top nav, dashboard, settings, branches | ✅ |
| 2 Operations | Catalogue, customers, bookings & repairs, slots, staff, assignment, maps links | ✅ |
| 3 Mobile | Customer app, technician app, auth, booking & job workflows | ✅ (push pending Firebase) |
| 4 Finance | Invoices, GST, payments, UPI verification, Razorpay (configurable), ledger, free services | ✅ |
| 5 AMC & reminders | AMC lifecycle & visits, 6-month reminders, email, WhatsApp sharing | ✅ |
| 6 Reports & release | Reports/exports, security hardening, deployment docs | ✅ docs; prod deployment pending server access |

## Realistic estimate for production go-live
- Credential-dependent integrations (FCM, Razorpay, SMTP, WhatsApp Cloud): 1–2 weeks after credentials.
- UAT with real staff, price/catalogue review, data migration: 2–3 weeks.
- Expanded automated test coverage & load testing: 1–2 weeks.
