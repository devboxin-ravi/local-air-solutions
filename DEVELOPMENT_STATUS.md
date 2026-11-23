# Local Air Solutions — Development Status

_Last updated: 22 Nov 2026_

## Summary

| Area | Status | Verified by |
|---|---|---|
| Backend API (Node/Express/TS, Prisma, MySQL 8) | ✅ Implemented | `tsc` clean, ESLint clean, 13 unit tests, 47-step E2E smoke test against a real database |
| Admin web panel (React/Vite/Tailwind) | ✅ Implemented | `tsc` clean, production build, 9 unit tests, all 58 routes rendered against the live API |
| Mobile app — customer + technician (Flutter, role-based) | ✅ Implemented | `flutter analyze` clean, 8 unit tests, web build verified against live API, release APK builds (`build/app/outputs/flutter-apk/app-release.apk`) |
| Push notifications (FCM) | ⚠️ Server ready, app not wired | Needs Firebase project config (see Blocked) |
| Razorpay | ⚠️ Implemented, disabled | Needs keys + business approval |
| WhatsApp Cloud API | ⚠️ Implemented, disabled | Needs Meta verification + templates; manual `wa.me` sharing works |
| SMTP email | ⚠️ Implemented, disabled | Needs SMTP credentials |

## Module checklist (master prompt §33)

| # | Acceptance item | Status |
|---|---|---|
| 1 | Admin secure login (lockout, refresh rotation, optional OTP) | ✅ |
| 2 | Horizontal top navigation, no sidebar | ✅ (hamburger drawer < 1280px) |
| 3 | All module dropdowns work | ✅ 10 modules, 60+ sub-pages |
| 4 | Permissions enforced by backend | ✅ RBAC + branch scoping on every route |
| 5 | Dynamic catalogue (36 seeded services, add more) | ✅ |
| 6 | Service & repair bookings | ✅ admin + customer app |
| 7 | Customer registration & booking | ✅ |
| 8 | Technician assignment (smart suggestions) | ✅ |
| 9 | Location & navigation | ✅ Maps directions via verified coordinates or address search (no invented coords). Embedded map views need a Maps API key |
| 10 | Technician completes jobs in app | ✅ accept → on the way → arrived → start → notes/photos → complete (+ OTP option) |
| 11 | Notes & photos saved | ✅ (MIME sniffed, size-limited) |
| 12 | Invoices & PDF | ✅ branded PDF, print, bulk share |
| 13 | GST calculations | ✅ CGST/SGST/IGST, Apply-GST toggle, discount allocation |
| 14 | Secure payment verification | ✅ UPI manual verify, Razorpay signature + webhook (idempotent) |
| 15 | Ledger consistency | ✅ append-only, row-locked running balance, reversals |
| 16 | Free services | ✅ value retained, 100% discount |
| 17 | AMC contracts & visits | ✅ draft → invoice → payment → active → visits → bookings |
| 18 | 6-month default reminders | ✅ auto-created on completion + daily job |
| 19 | Email & WhatsApp | ✅ wa.me sharing; email works once SMTP configured |
| 20 | Branch operations & access | ✅ |
| 21 | Reports from real data | ✅ 9 reports, CSV/XLSX/PDF |
| 22 | Validation web/mobile/backend | ✅ Zod (API + admin), Flutter validators |
| 23 | Transactions for finance | ✅ |
| 24 | Responsive, polished UI | ✅ |
| 25 | Automated tests | ✅ (expand coverage — see Next) |

## Blocked / needs business input

1. **Firebase Cloud Messaging** — create a Firebase project, add `google-services.json` / `GoogleService-Info.plist`, then add `firebase_messaging` to the app and register tokens via `POST /auth/devices`. Server side is done (`FCM_*` env vars).
2. **Razorpay** — set `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, enable in Settings → Payment, and add the Razorpay checkout SDK to the app (server order/verify/webhook endpoints exist).
3. **WhatsApp Business Cloud API** — keep disabled until Meta verification and template approval.
4. **SMTP** — set `SMTP_*` to enable OTP emails, invoice emails and email notifications. Without SMTP, OTPs are only logged in **development**.
5. **Google Maps API key** — needed only for embedded maps (current flows open Google Maps).
6. **Service prices** — seeded prices are indicative “starting” prices; review in Admin → Services → Service Pricing.
7. **Company profile** — GSTIN, address, UPI ID and support numbers in Admin → Settings.

## Release notes for the APK

- The APK bundles `app-flutter/.env`; set `API_BASE_URL` to the real HTTPS API before building for devices (emulator: `http://10.0.2.2:8000/api/v1`, debug builds only).
- Release signing currently uses the Flutter debug key — create a keystore and `android/key.properties` before Play Store upload.
- Windows note: `kotlin.incremental=false` is set in `android/gradle.properties` because the project and pub-cache are on different drives.

## Next steps (recommended)

- Integration tests with an isolated test database (concurrency: slot double-booking, ledger under parallel payments).
- Wire FCM + Razorpay SDKs in Flutter after credentials are available.
- Offline write queue for technician actions (currently: offline read cache + clear retry message).
- Embedded map views (booking pins, service areas) once a Maps key is provisioned.

## Local credentials (development seed only)

| User | Login | Password |
|---|---|---|
| Super Admin | value of `SEED_ADMIN_EMAIL` | value of `SEED_ADMIN_PASSWORD` — **change immediately** |
| Branch Manager (demo) | manager@demo.local | Demo@1234 |
| Technician (demo) | tech@demo.local | Demo@1234 |
| Customer (demo) | customer@demo.local | Demo@1234 |

Demo data is created only by `npm run db:seed:demo` and refuses to run in production.
