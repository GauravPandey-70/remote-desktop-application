# ============================================
# DeskLink — API Server Dockerfile
# Multi-stage build for minimal production image.
# ============================================

# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/common/package.json packages/common/
COPY packages/api-server/package.json packages/api-server/

RUN npm ci --workspace=packages/common --workspace=packages/api-server

COPY packages/common/ packages/common/
COPY packages/api-server/ packages/api-server/

RUN npm run build --workspace=packages/common
RUN npm run build --workspace=packages/api-server

# --- Production Stage ---
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/common/package.json packages/common/
COPY --from=builder /app/packages/common/dist/ packages/common/dist/
COPY --from=builder /app/packages/api-server/package.json packages/api-server/
COPY --from=builder /app/packages/api-server/dist/ packages/api-server/dist/

RUN npm ci --workspace=packages/common --workspace=packages/api-server --omit=dev

RUN addgroup -g 1001 -S desklink && adduser -S desklink -u 1001
USER desklink

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "packages/api-server/dist/main.js"]

