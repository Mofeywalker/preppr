# syntax=docker/dockerfile:1

# ---- base: native build tools + runtime deps (ffmpeg, yt-dlp) ----
FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++ ffmpeg yt-dlp

# ---- deps: install node_modules with native build tools available ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: build the Next.js app ----
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal image with ffmpeg + yt-dlp + built app ----
FROM node:22-alpine AS runner
RUN apk add --no-cache ffmpeg yt-dlp
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /data
VOLUME /data

EXPOSE 3000
CMD ["npm", "start"]
