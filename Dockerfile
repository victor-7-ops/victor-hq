# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ sqlite-dev
WORKDIR /app
COPY package.json package-lock.json ./
# Force native compilation for Alpine (musl) — skip prebuilt binaries
RUN npm ci --ignore-scripts \
    && npm_config_build_from_source=true npm rebuild better-sqlite3

# ── Stage 2: Build Next.js ──
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ sqlite-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders so gateway SDK + requireEnv don't throw during page collection
ENV OPENCLAW_GATEWAY_TOKEN=build-placeholder
ENV OPENCLAW_HOME=/tmp
ENV OPENCLAW_BIN=/usr/local/bin/openclaw
RUN npm run build

# ── Stage 3: Production runtime (standalone) ──
FROM node:20-alpine AS runner
RUN apk add --no-cache sqlite-dev wget git
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3333

# Standalone output includes server.js + minimal node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

# Ensure the standalone output has a correctly-compiled native binary
# (Next.js standalone trace may copy the wrong binary)
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

EXPOSE 3333
CMD ["node", "server.js"]
