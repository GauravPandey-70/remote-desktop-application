# ============================================
# DeskLink — Signaling Server Dockerfile
# Multi-stage build for minimal production image.
# ============================================

# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# Copy package manifests for dependency resolution
COPY packages/common/package.json packages/common/
COPY packages/signaling-server/package.json packages/signaling-server/

# Install dependencies
RUN npm ci --workspace=packages/common --workspace=packages/signaling-server

# Copy source
COPY packages/common/ packages/common/
COPY packages/signaling-server/ packages/signaling-server/

# Build
RUN npm run build --workspace=packages/common
RUN npm run build --workspace=packages/signaling-server

# --- Production Stage ---
FROM node:20-alpine AS production

WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/common/package.json packages/common/
COPY --from=builder /app/packages/common/dist/ packages/common/dist/
COPY --from=builder /app/packages/signaling-server/package.json packages/signaling-server/
COPY --from=builder /app/packages/signaling-server/dist/ packages/signaling-server/dist/

# Install production dependencies only
RUN npm ci --workspace=packages/common --workspace=packages/signaling-server --omit=dev

# Non-root user
RUN addgroup -g 1001 -S desklink && adduser -S desklink -u 1001
USER desklink

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["node", "packages/signaling-server/dist/server.js"]
