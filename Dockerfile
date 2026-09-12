# syntax=docker/dockerfile:1

# ---- base: native build tools for compiling native addons (better-sqlite3) ----
FROM node:22-alpine AS base
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN apk add --no-cache python3 make g++

# ---- deps: install all dependencies with native build tools available ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: build the Next.js standalone application ----
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal production runtime image ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Consolidated single layer for OS packages, non-root user, and data directory
RUN apk add --no-cache ffmpeg yt-dlp && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /data/uploads && chown -R nextjs:nodejs /data

# Copy application assets and standalone output with non-root ownership
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

VOLUME /data
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
