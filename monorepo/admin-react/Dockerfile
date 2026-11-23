# =========================
# Stage 1: Build React App
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./

# Build-time Vite envs (Coolify → Build Arguments)
ARG VITE_API_BASE_URL
ARG VITE_ASSET_BASE_URL
ARG VITE_APP_NAME=Local Air Solutions
ARG VITE_APP_VERSION=1.0.0
ARG VITE_GOOGLE_MAPS_KEY=

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_ASSET_BASE_URL=${VITE_ASSET_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
ENV VITE_GOOGLE_MAPS_KEY=${VITE_GOOGLE_MAPS_KEY}

RUN npm run build

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
