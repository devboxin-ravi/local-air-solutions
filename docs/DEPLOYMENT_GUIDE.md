# Deployment Guide

## 1. Local development
```bash
# MySQL 8 running locally
cd monorepo/backend-node
cp .env.example .env            # set DATABASE_URL, JWT_ACCESS_SECRET, SEED_ADMIN_*
npm install
npx prisma migrate dev          # creates schema
npm run db:seed                 # roles, permissions, Super Admin, states, 36 services, settings
npm run db:seed:demo            # OPTIONAL demo branch/technician/customer (never in prod)
npm run dev                     # http://localhost:8000  ·  docs: /api/docs

cd ../admin-react
cp .env.example .env
npm install && npm run dev      # http://localhost:5173

cd ../app-flutter
cp .env.example .env            # Android emulator: API_BASE_URL=http://10.0.2.2:8000/api/v1
flutter pub get && flutter run
```
Tests: `npm test` (backend), `npm run test:e2e` (backend, needs running API + seeds), `npm test` (admin), `flutter test`.

## 2. Production server (Ubuntu 22.04+ example)
1. **MySQL 8**: create DB `local_air_solutions` (utf8mb4) and a least-privilege user.
2. **Backend**
   ```bash
   npm ci && npx prisma generate && npm run build
   NODE_ENV=production npx prisma migrate deploy
   NODE_ENV=production npm run db:seed          # first install only
   pm2 start dist/server.js --name las-api      # or systemd
   ```
   Required env: `NODE_ENV=production`, `DATABASE_URL`, strong random `JWT_ACCESS_SECRET` (≥48 bytes), `PUBLIC_BASE_URL=https://api.yourdomain`, `CORS_ORIGINS=https://admin.yourdomain`, `UPLOAD_DIR=/var/lib/las/uploads` (persistent). Optional: `SMTP_*`, `RAZORPAY_*`, `FCM_*`, `WHATSAPP_*`.
   Keep `uploads/brand/logo.png` (used on invoice PDFs) in the upload directory.
3. **Admin**: `npm ci && npm run build` with `VITE_API_BASE_URL=https://api.yourdomain/api/v1`, `VITE_ASSET_BASE_URL=https://api.yourdomain`; serve `dist/` from Nginx with SPA fallback (`try_files $uri /index.html`).
4. **Nginx + HTTPS**: reverse proxy `api.yourdomain → 127.0.0.1:8000`, `client_max_body_size 10m`, Let’s Encrypt certificates (`certbot --nginx`), HSTS.
5. **Jobs**: run inside the API process (`JOBS_ENABLED=true`). With multiple API instances, enable jobs on exactly one instance.
6. **Mobile release**
   ```bash
   # .env → API_BASE_URL=https://api.yourdomain/api/v1, APP_ENV=production
   flutter build appbundle --release     # Play Store (configure android/key.properties signing)
   flutter build apk --release           # side-load / testing
   ```
   Release builds are HTTPS-only (cleartext allowed only in the debug manifest).

## 3. Security checklist
- Change the seeded Super Admin password on first login; disable unused accounts.
- Secrets only in server env files (`chmod 600`), never in admin/app builds.
- `trust proxy` is enabled — keep the API behind your proxy only.
- Rate limits: `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`. Lockout: `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`.
- Enable `OTP_ENABLED=true` once SMTP is configured.

## 4. Backups & monitoring
- Nightly: `mysqldump --single-transaction local_air_solutions | gzip > /backups/las-$(date +%F).sql.gz`; 30-day retention; weekly off-site; quarterly restore test.
- Back up `UPLOAD_DIR` daily (rsync/object storage).
- Logs are JSON lines on stdout — ship to your log platform; alert on `"level":"ERROR"` and on `job failed`.
- Health check: `GET /health`.
