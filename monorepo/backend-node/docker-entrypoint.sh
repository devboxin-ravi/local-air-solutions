#!/bin/sh
# Runs Prisma migrate + seed on container start (not build — DB is only available at runtime).
set -e

echo "[entrypoint] NODE_ENV=${NODE_ENV:-} PORT=${PORT:-} RUN_MIGRATIONS=${RUN_MIGRATIONS:-true} RUN_SEED=${RUN_SEED:-true}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

# Wait for MySQL (Coolify DB may start a few seconds after the app)
if [ "${RUN_MIGRATIONS:-true}" = "true" ] || [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[entrypoint] Waiting for database..."
  i=0
  until node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.\$queryRawUnsafe('SELECT 1').then(()=>{console.log('[entrypoint] Database OK'); return p.\$disconnect();}).then(()=>process.exit(0)).catch(async (e)=>{console.error('[entrypoint] DB not ready:', e.message); try{await p.\$disconnect()}catch(_){ } process.exit(1);});" ; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
      echo "[entrypoint] ERROR: Database not reachable after ~60s. Check DATABASE_URL / DB service." >&2
      exit 1
    fi
    sleep 2
  done
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS!=true)."
fi

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma seed..."
  # Seed is idempotent; do not block API boot if it fails after migrations
  if ! npx ts-node --transpile-only prisma/seed.ts; then
    echo "[entrypoint] WARNING: seed failed — starting API anyway. Check logs / SEED_* env." >&2
  else
    echo "[entrypoint] Seed complete."
  fi
else
  echo "[entrypoint] Skipping seed (RUN_SEED!=true)."
fi

echo "[entrypoint] Starting: $*"
exec "$@"
