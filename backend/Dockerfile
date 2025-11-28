# Multi-stage build for BSIM Backend

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bsim

# Copy dependencies from deps stage
COPY --from=deps --chown=bsim:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=bsim:nodejs /app/prisma ./prisma

# Copy built application from builder stage
COPY --from=builder --chown=bsim:nodejs /app/dist ./dist
COPY --from=builder --chown=bsim:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy package.json for running scripts
COPY --chown=bsim:nodejs package*.json ./

# Switch to non-root user
USER bsim

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server.js"]
