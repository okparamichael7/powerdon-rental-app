# Powerdon TCP Proxy Server
# Multi-stage build for optimal image size

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY server/package.json server/package-lock.json* ./server/
COPY lib/wscharge ./lib/wscharge/

# Install dependencies
WORKDIR /app/server
RUN npm ci

# Copy source
COPY server/tsconfig.json ./
COPY server/*.ts ./

# Build
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 proxy

# Copy built files
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./

# Set ownership
RUN chown -R proxy:nodejs /app

USER proxy

# Environment variables
ENV NODE_ENV=production
ENV TCP_PORT=8088
ENV WS_PORT=8089
ENV LOG_LEVEL=info

# Expose ports
EXPOSE 8088 8089

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8089/health || exit 1

# Start server
CMD ["node", "dist/tcp-proxy.js"]
