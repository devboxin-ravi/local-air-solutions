#!/bin/sh
# Runs Prisma migrate + seed on container start (not build — DB is only available at runtime).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy
  echo "[entrypoint] Migrations complete."
fi

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma seed..."
  npx ts-node --transpile-only prisma/seed.ts
  echo "[entrypoint] Seed complete."
fi

exec "$@"
