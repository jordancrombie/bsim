# Multi-stage build for BSIM Authorization Server

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src

RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 oidc

COPY --from=deps --chown=oidc:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=oidc:nodejs /app/prisma ./prisma

COPY --from=builder --chown=oidc:nodejs /app/dist ./dist
COPY --from=builder --chown=oidc:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=oidc:nodejs /app/src/views ./dist/views

COPY --chown=oidc:nodejs package*.json ./

USER oidc

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "--max-old-space-size=384", "dist/server.js"]
