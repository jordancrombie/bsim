# WSIM Integration Plan for BSIM

This document outlines the work required in BSIM to integrate the Wallet Simulator (WSIM) into the local development and production environments.

## Overview

WSIM is a digital wallet simulator that allows users to enroll their BSIM credit cards into a wallet, then use that wallet to make payments at merchants (SSIM). The integration requires:

1. **BSIM changes** - New OIDC scope, database model, API endpoints, and consent UI
2. **Infrastructure changes** - Nginx routing, docker-compose services, hosts entries
3. **Cross-service configuration** - OAuth client registration, SSIM/NSIM updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Payment Flow with WSIM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User enrolls card in wallet:                                             │
│     WSIM → BSIM Auth (wallet:enroll) → User consents → WSIM gets credential │
│                                                                              │
│  2. User pays at merchant with wallet:                                       │
│     SSIM → WSIM Auth (payment:authorize) → User selects wallet card         │
│          → WSIM generates ephemeral token → NSIM → BSIM (authorize)         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Phase 1: BSIM Backend Changes

### 1.1 Add `wallet:enroll` OIDC Scope

**File:** `auth-server/src/config/provider.ts`

Add new scope to supported scopes list:
```typescript
'wallet:enroll' // Enroll cards in digital wallet, returns wallet_credential + fi_user_ref
```

Claims to return:
- `wallet_credential` - Long-lived JWT (90-day expiry) for wallet API access
- `fi_user_ref` - User's financial institution reference

### 1.2 Database Model

**File:** `backend/prisma/schema.prisma`

```prisma
model WalletCredential {
  id              String    @id @default(uuid())
  credentialToken String    @unique
  userId          String
  walletId        String    // WSIM's identifier
  walletName      String    // e.g., "WSIM Wallet"
  permittedCards  String[]  // Array of credit card IDs user consented to share
  scopes          String[]  // Permitted operations: ["cards:read", "payments:create"]
  issuedAt        DateTime  @default(now())
  expiresAt       DateTime
  revokedAt       DateTime?
  lastUsedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([walletId])
  @@index([credentialToken])
  @@map("wallet_credentials")
}
```

### 1.3 Wallet API Endpoints

**File:** `backend/src/routes/wallet.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallet/cards` | GET | Get user's cards (masked) for wallet display |
| `/api/wallet/tokens` | POST | Generate ephemeral payment token for a card |
| `/api/wallet/credentials/:id/revoke` | POST | Revoke a wallet credential |
| `/api/wallet/credentials/:id/status` | GET | Check credential validity |

Authentication: Bearer token with `wallet_credential` JWT

### 1.4 Consent UI Updates

**File:** `auth-server/views/consent.ejs` (or new `wallet-consent.ejs`)

When `wallet:enroll` scope is requested:
- Show wallet-specific messaging: "Allow [Wallet Name] to access your cards?"
- List cards that will be shared with the wallet
- Explain what the wallet can do (view cards, make payments)

### 1.5 Registry Info Endpoint (Optional)

**File:** `backend/src/routes/registry.ts`

```typescript
GET /api/registry/info
{
  "id": "bsim",
  "name": "BSIM - Banking Simulator",
  "apiUrl": "https://api.banksim.ca",
  "authUrl": "https://auth.banksim.ca",
  "supportedCardTypes": ["visa", "mastercard"],
  "walletEnrollmentSupported": true
}
```

## Phase 2: Infrastructure Changes (BSIM Responsibility)

### 2.1 Hosts File Updates

**File:** `Makefile` (update `dev-hosts` target)

Add entries:
```
127.0.0.1 wsim-dev.banksim.ca
127.0.0.1 wsim-auth-dev.banksim.ca
```

### 2.2 Nginx Configuration

**File:** `nginx/nginx.dev.conf`

Add two new server blocks:

```nginx
# WSIM Frontend + API (wsim-dev.banksim.ca)
server {
    listen 443 ssl;
    server_name wsim-dev.banksim.ca;

    ssl_certificate /etc/nginx/certs/banksim.ca.crt;
    ssl_certificate_key /etc/nginx/certs/banksim.ca.key;

    # API routes
    location /api {
        set $wsim_backend_upstream wsim-backend:3003;
        proxy_pass http://$wsim_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend routes
    location / {
        set $wsim_frontend_upstream wsim-frontend:3000;
        proxy_pass http://$wsim_frontend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# WSIM Auth Server (wsim-auth-dev.banksim.ca)
server {
    listen 443 ssl;
    server_name wsim-auth-dev.banksim.ca;

    ssl_certificate /etc/nginx/certs/banksim.ca.crt;
    ssl_certificate_key /etc/nginx/certs/banksim.ca.key;

    location / {
        set $wsim_auth_upstream wsim-auth-server:3005;
        proxy_pass http://$wsim_auth_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2.3 Docker Compose Services

**File:** `docker-compose.yml` (add WSIM services)

```yaml
  # WSIM Backend
  wsim-backend:
    build:
      context: ../wsim/backend
      dockerfile: Dockerfile
    container_name: wsim-backend
    ports:
      - "3007:3003"  # External 3007, internal 3003
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://bsim:${DB_PASSWORD:-bsim_dev_password}@db:5432/bsim
      PORT: 3003
      BSIM_API_URL: http://backend:3001
      BSIM_AUTH_URL: https://auth-dev.banksim.ca
    depends_on:
      db:
        condition: service_healthy
    networks:
      - bsim-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # WSIM Auth Server
  wsim-auth-server:
    build:
      context: ../wsim/auth-server
      dockerfile: Dockerfile
    container_name: wsim-auth
    ports:
      - "3008:3005"  # External 3008, internal 3005
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://bsim:${DB_PASSWORD:-bsim_dev_password}@db:5432/bsim
      PORT: 3005
      ISSUER: https://wsim-auth-dev.banksim.ca
    depends_on:
      db:
        condition: service_healthy
    networks:
      - bsim-network

  # WSIM Frontend
  wsim-frontend:
    build:
      context: ../wsim/frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://wsim-dev.banksim.ca/api
        NEXT_PUBLIC_AUTH_URL: https://wsim-auth-dev.banksim.ca
    container_name: wsim-frontend
    ports:
      - "3009:3000"  # External 3009, internal 3000
    depends_on:
      - wsim-backend
    networks:
      - bsim-network
```

**File:** `docker-compose.dev.yml` (add dev overrides)

```yaml
  wsim-backend:
    environment:
      BSIM_AUTH_URL: https://auth-dev.banksim.ca
      WSIM_AUTH_URL: https://wsim-auth-dev.banksim.ca
      CORS_ORIGIN: https://wsim-dev.banksim.ca,https://ssim-dev.banksim.ca

  wsim-auth-server:
    environment:
      ISSUER: https://wsim-auth-dev.banksim.ca
      CORS_ORIGIN: https://wsim-dev.banksim.ca,https://ssim-dev.banksim.ca
      BSIM_AUTH_URL: https://auth-dev.banksim.ca

  wsim-frontend:
    build:
      args:
        NEXT_PUBLIC_API_URL: https://wsim-dev.banksim.ca/api
        NEXT_PUBLIC_AUTH_URL: https://wsim-auth-dev.banksim.ca
```

## Phase 3: OAuth Client Registration

### 3.1 Register WSIM as BSIM OAuth Client

WSIM needs to be registered as an OAuth client in BSIM's auth-server to use the `wallet:enroll` scope.

Via Admin UI or database seed:
```json
{
  "clientId": "wsim-client",
  "clientSecret": "<generated>",
  "name": "WSIM - Wallet Simulator",
  "redirectUris": [
    "https://wsim-dev.banksim.ca/auth/callback/bsim",
    "https://wsim.banksim.ca/auth/callback/bsim"
  ],
  "scopes": ["openid", "profile", "wallet:enroll"],
  "grantTypes": ["authorization_code", "refresh_token"]
}
```

### 3.2 Register SSIM as WSIM OAuth Client

SSIM needs to be registered in WSIM's auth-server to use wallet payments.

```json
{
  "clientId": "ssim-client",
  "clientSecret": "<generated>",
  "name": "SSIM - Store Simulator",
  "redirectUris": [
    "https://ssim-dev.banksim.ca/payment/callback",
    "https://ssim.banksim.ca/payment/callback"
  ],
  "scopes": ["openid", "payment:authorize"],
  "grantTypes": ["authorization_code"]
}
```

## Phase 4: SSIM and NSIM Updates

### 4.1 SSIM Configuration

Add WSIM as a payment provider option:

```env
WSIM_ENABLED=true
WSIM_AUTH_URL=https://wsim-auth-dev.banksim.ca
WSIM_CLIENT_ID=ssim-client
WSIM_CLIENT_SECRET=<secret>
```

### 4.2 NSIM Wallet Token Routing

NSIM needs to recognize wallet card tokens and route them appropriately:

```env
WSIM_ENABLED=true
```

Wallet tokens contain routing information that NSIM parses to determine:
1. Which wallet issued the token (WSIM)
2. Which bank holds the underlying card (BSIM)
3. The ephemeral card token for authorization

## Implementation Order

1. **BSIM Backend** (Phase 1) ✅ COMPLETED
   - [x] Add `wallet:enroll` scope to auth-server
   - [x] Create WalletCredential database model and migration
   - [x] Implement wallet API endpoints
   - [x] Update consent UI for wallet enrollment

2. **Infrastructure** (Phase 2)
   - [ ] Update Makefile `dev-hosts` target
   - [ ] Add WSIM server blocks to nginx.dev.conf
   - [ ] Add WSIM services to docker-compose files

3. **OAuth Registration** (Phase 3)
   - [ ] Register WSIM client in BSIM auth-server
   - [ ] Document SSIM client registration for WSIM

4. **Cross-service Config** (Phase 4)
   - [ ] Update SSIM environment for WSIM support
   - [ ] Update NSIM environment for wallet token routing

## Environment Variables Summary

### BSIM New Variables
```env
# Wallet credential settings
WALLET_CREDENTIAL_EXPIRY_DAYS=90
WALLET_CREDENTIAL_ISSUER=https://auth.banksim.ca

# Optional: NSIM registry URL for auto-registration
NSIM_REGISTRY_URL=https://payment.banksim.ca/api/v1/registry
```

### WSIM Required Variables (for reference)
```env
# Database (shares with BSIM)
DATABASE_URL=postgresql://bsim:password@db:5432/bsim

# BSIM Integration
BSIM_API_URL=https://api.banksim.ca
BSIM_AUTH_URL=https://auth.banksim.ca
BSIM_CLIENT_ID=wsim-client
BSIM_CLIENT_SECRET=<secret>

# WSIM Identity
WSIM_ISSUER=https://wsim-auth.banksim.ca
```

## Testing Checklist

- [ ] User can enroll cards from BSIM into WSIM wallet
- [ ] WSIM receives valid wallet_credential JWT
- [ ] WSIM can list user's enrolled cards via `/api/wallet/cards`
- [ ] WSIM can generate ephemeral payment tokens
- [ ] SSIM can initiate wallet payment flow
- [ ] NSIM routes wallet payments to correct BSIM
- [ ] User can revoke wallet access from BSIM

## Notes

- WSIM uses the same PostgreSQL database as BSIM (shared `db` container)
- All WSIM services use the `*.banksim.ca` wildcard SSL certificate
- WSIM operates its own OIDC provider (separate from BSIM's auth-server)
- Wallet credentials are long-lived (90 days) vs payment tokens (short-lived)
