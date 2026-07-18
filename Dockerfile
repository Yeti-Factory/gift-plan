# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build ----------
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Nitro preset for a standalone Node.js server (VPS/Docker),
# instead of the default Cloudflare Workers preset.
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

# Build-time public env (must be present for Vite to inline them)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Non-root user for the runtime process (defense-in-depth).
RUN addgroup -S app && adduser -S app -G app

# Nitro node-server output is fully self-contained in .output/
COPY --from=builder --chown=app:app /app/.output ./.output

USER app

EXPOSE 3000

# Healthcheck hits the dedicated JSON endpoint (200 = healthy, 503 = degraded)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/public/health >/dev/null 2>&1 || exit 1

CMD ["node", ".output/server/index.mjs"]