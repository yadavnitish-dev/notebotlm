# Multi-stage Dockerfile for NoteBotLM
# Targets: app (Next.js standalone) | worker (BullMQ PDF processor)
#
# Build:
#   docker build --target app --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co -t notebot-lm-app .
#   docker build --target worker -t notebot-lm-worker .

FROM node:18-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are inlined at build time by Next.js
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
RUN npm run build

# ── App: Next.js standalone server ──────────────────────────────────────────
FROM node:18-bookworm-slim AS app

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

# ── Worker: background PDF processing queue ───────────────────────────────────
FROM node:18-bookworm-slim AS worker

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

CMD ["npx", "tsx", "src/server/api/routers/chat/worker.ts"]
