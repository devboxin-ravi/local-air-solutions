# =========================
# Stage 1: Build the server + seed
# =========================
FROM node:20-alpine AS builder

# OpenSSL required for Prisma engine detection/generate on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./

# Generate Prisma client (includes linux-musl-openssl-3.0.x from schema)
RUN npx prisma generate

# Build API (dist/) + compiled seed (dist-seed/) — no ts-node at runtime
RUN npm run build

# =========================
# Stage 2: Production runtime
# =========================
FROM node:20-alpine

# curl = healthchecks; openssl = Prisma query engine (libssl)
RUN apk add --no-cache curl openssl

WORKDIR /app

COPY package*.json ./

# Production deps + Prisma CLI for migrate deploy
RUN npm install --omit=dev \
  && npm install prisma@5.22.0 --no-save

# Prisma schema + migrations (required for migrate deploy)
COPY --from=builder /app/prisma ./prisma

# Compiled API + compiled seed (uses SEED_* env at runtime)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-seed ./dist-seed

# Entrypoint: migrate → seed → start
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Generate Prisma client in the runtime image (openssl-3 musl engine)
RUN npx prisma generate

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000
ENV RUN_MIGRATIONS=true
ENV RUN_SEED=true

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
