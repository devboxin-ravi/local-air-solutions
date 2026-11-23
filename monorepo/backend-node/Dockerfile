# =========================
# Stage 1: Build the server
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./

# Generate Prisma client before TypeScript compile
RUN npx prisma generate

# Build the server (tsc outputs to dist/)
RUN npm run build

# =========================
# Stage 2: Production runtime
# =========================
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./

# Production deps + tools needed at startup for migrate/seed
RUN npm install --omit=dev \
  && npm install prisma@5.22.0 ts-node@10.9.2 typescript@5.3.2 --no-save

# Prisma schema + migrations (required for migrate deploy)
COPY --from=builder /app/prisma ./prisma

# App source needed by seed.ts (imports src/config + constants)
COPY --from=builder /app/src ./src

# Compiled server
COPY --from=builder /app/dist ./dist

# Entrypoint: migrate → seed → start
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Generate Prisma client in the runtime image
RUN npx prisma generate

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000
ENV RUN_MIGRATIONS=true
ENV RUN_SEED=true

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
