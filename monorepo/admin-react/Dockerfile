# =========================
# Stage 1: Build React App
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./

# Build-time Vite envs (Coolify → Build Arguments / Build-time Variables)
# Defaults target production domains; override in Coolify if needed.
# Note: do not put spaces in ARG defaults (Docker truncates); apply name default in the RUN shell.
ARG VITE_API_BASE_URL=https://local-air-api.developerbox.sbs/api/v1
ARG VITE_ASSET_BASE_URL=https://local-air-api.developerbox.sbs
ARG VITE_APP_NAME
ARG VITE_APP_VERSION=1.0.0
ARG VITE_GOOGLE_MAPS_KEY=

# Bake Vite envs into the client bundle (empty API URL = blank white screen in browser)
RUN if [ -z "$VITE_API_BASE_URL" ]; then echo "ERROR: VITE_API_BASE_URL is empty" >&2; exit 1; fi \
  && VITE_API_BASE_URL="$VITE_API_BASE_URL" \
     VITE_ASSET_BASE_URL="$VITE_ASSET_BASE_URL" \
     VITE_APP_NAME="${VITE_APP_NAME:-Local Air Solutions}" \
     VITE_APP_VERSION="${VITE_APP_VERSION:-1.0.0}" \
     VITE_GOOGLE_MAPS_KEY="$VITE_GOOGLE_MAPS_KEY" \
     npm run build

# =========================
# Stage 2: Nginx
# =========================
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
