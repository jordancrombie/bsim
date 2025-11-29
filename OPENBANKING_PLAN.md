# Open Banking Implementation Plan

## Overview

Implement an FDX-inspired Open Banking platform with:
1. **Authorization Server** (`auth.banksim.ca`) - OpenID Connect provider
2. **Resource Server** (`openbanking.banksim.ca`) - Open Banking API

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Third-Party    │────▶│  Authorization   │────▶│   Resource Server   │
│  Application    │     │  Server (OIDC)   │     │  (Open Banking API) │
│                 │◀────│  auth.banksim.ca │◀────│ openbanking.banksim │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌─────────────────────────────────────┐
                        │          PostgreSQL Database        │
                        │  (Users, Accounts, OIDC Clients,    │
                        │   Consents, Tokens)                 │
                        └─────────────────────────────────────┘
```

## Phase 1: Authorization Server (auth.banksim.ca)

### Technology
- **Node.js + Express + TypeScript** (consistent with existing backend)
- **oidc-provider** library - certified OpenID Connect implementation
- Shares database with main backend via Prisma

### New Database Models

```prisma
// OAuth 2.0 / OIDC Clients (Third-party applications)
model OAuthClient {
  id            String   @id @default(uuid())
  clientId      String   @unique
  clientSecret  String   // hashed
  clientName    String
  redirectUris  String[] // Array of allowed redirect URIs
  grantTypes    String[] // ['authorization_code']
  responseTypes String[] // ['code']
  scope         String   // Space-separated allowed scopes
  logoUri       String?
  policyUri     String?
  tosUri        String?
  contacts      String[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  consents      Consent[]

  @@map("oauth_clients")
}

// User consents for third-party access
model Consent {
  id            String      @id @default(uuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientId      String
  client        OAuthClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  scopes        String[]    // Granted scopes
  accountIds    String[]    // Specific accounts user consented to share
  expiresAt     DateTime?   // Consent expiration
  revokedAt     DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([userId, clientId])
  @@map("consents")
}
```

### OIDC Configuration

**Supported Flows:**
- Authorization Code Flow (initial implementation)
- PKCE support (future enhancement)

**Endpoints:**
- `GET /.well-known/openid-configuration` - Discovery document
- `GET /auth` - Authorization endpoint
- `POST /token` - Token endpoint
- `GET /userinfo` - UserInfo endpoint
- `GET /jwks` - JSON Web Key Set
- `POST /token/revoke` - Token revocation
- `POST /token/introspect` - Token introspection

### FDX-Inspired Scopes

| Scope | Description |
|-------|-------------|
| `openid` | Required for OIDC, returns sub claim |
| `profile` | User profile: name, DOB |
| `email` | User email address |
| `fdx:accountdetailed:read` | Read account details and balances |
| `fdx:transactions:read` | Read transaction history |
| `fdx:customercontact:read` | Read customer contact info (address, phone) |

### Consent Screen

When a third-party requests access, users will see:
- Application name and logo
- Requested permissions (human-readable)
- Which accounts to share (multi-select)
- Consent duration options
- Approve/Deny buttons

### Directory Structure

```
/Users/jcrombie/ai/bsim/auth-server/
├── package.json
├── tsconfig.json
├── Dockerfile
├── prisma/
│   └── schema.prisma (extends main schema)
├── src/
│   ├── server.ts
│   ├── config/
│   │   ├── oidc.ts         # oidc-provider configuration
│   │   └── env.ts
│   ├── adapters/
│   │   └── prisma.ts       # Prisma adapter for oidc-provider
│   ├── routes/
│   │   ├── consent.ts      # Consent UI routes
│   │   └── interaction.ts  # OIDC interaction routes
│   ├── views/
│   │   ├── login.ejs       # Login page
│   │   └── consent.ejs     # Consent page
│   └── utils/
│       └── crypto.ts
└── public/
    └── styles.css
```

## Phase 2: Resource Server (openbanking.banksim.ca)

### Technology
- **Node.js + Express + TypeScript**
- JWT validation against auth server
- Shares database with main backend

### FDX-Inspired API Endpoints

**Customer Endpoints:**
- `GET /customers/current` - Get authenticated customer ID

**Account Endpoints:**
- `GET /accounts` - List consented accounts
- `GET /accounts/{accountId}` - Account details with balance

**Transaction Endpoints:**
- `GET /accounts/{accountId}/transactions` - Transaction history
  - Query params: `startTime`, `endTime`, `limit`, `offset`

### Response Format (FDX-style)

```json
{
  "accounts": [
    {
      "accountId": "uuid",
      "accountNumber": "****1234",  // Masked
      "accountType": "CHECKING",
      "status": "OPEN",
      "currency": "CAD",
      "balance": {
        "current": 1500.00,
        "available": 1450.00
      },
      "accountHolder": {
        "name": "John Doe"
      }
    }
  ],
  "page": {
    "nextOffset": "..."
  }
}
```

### Directory Structure

```
/Users/jcrombie/ai/bsim/openbanking/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── server.ts
│   ├── config/
│   │   └── env.ts
│   ├── middleware/
│   │   ├── tokenValidator.ts  # Validate access tokens
│   │   └── scopeChecker.ts    # Check required scopes
│   ├── controllers/
│   │   ├── customerController.ts
│   │   ├── accountController.ts
│   │   └── transactionController.ts
│   ├── routes/
│   │   ├── customerRoutes.ts
│   │   ├── accountRoutes.ts
│   │   └── transactionRoutes.ts
│   └── services/
│       └── consentService.ts  # Verify consent for accounts
```

## Phase 3: Infrastructure Updates

### Docker Compose Additions

```yaml
# Authorization Server
auth-server:
  build:
    context: ./auth-server
    dockerfile: Dockerfile
  container_name: bsim-auth
  environment:
    NODE_ENV: production
    PORT: 3003
    DATABASE_URL: postgresql://bsim:bsim_dev_password@db:5432/bsim
    ISSUER: https://auth.banksim.ca
    JWKS_SECRET: ${JWKS_SECRET:-dev-jwks-secret}
  depends_on:
    db:
      condition: service_healthy
  networks:
    - bsim-network

# Open Banking Resource Server
openbanking:
  build:
    context: ./openbanking
    dockerfile: Dockerfile
  container_name: bsim-openbanking
  environment:
    NODE_ENV: production
    PORT: 3004
    DATABASE_URL: postgresql://bsim:bsim_dev_password@db:5432/bsim
    AUTH_SERVER_ISSUER: https://auth.banksim.ca
    JWKS_URI: https://auth.banksim.ca/.well-known/jwks.json
  depends_on:
    - auth-server
    db:
      condition: service_healthy
  networks:
    - bsim-network
```

### Nginx Configuration Updates

```nginx
# Authorization Server (auth.banksim.ca)
upstream auth_server {
    server auth-server:3003;
}

server {
    listen 443 ssl;
    server_name auth.banksim.ca;

    ssl_certificate /etc/nginx/certs/banksim.ca.crt;
    ssl_certificate_key /etc/nginx/certs/banksim.ca.key;

    location / {
        proxy_pass http://auth_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Open Banking API (openbanking.banksim.ca)
upstream openbanking {
    server openbanking:3004;
}

server {
    listen 443 ssl;
    server_name openbanking.banksim.ca;

    ssl_certificate /etc/nginx/certs/banksim.ca.crt;
    ssl_certificate_key /etc/nginx/certs/banksim.ca.key;

    location / {
        proxy_pass http://openbanking;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Implementation Order

### Step 1: Database Schema Updates
- Add OAuthClient and Consent models to Prisma schema
- Run migration

### Step 2: Authorization Server
1. Create auth-server directory structure
2. Set up Express + oidc-provider
3. Implement Prisma adapter for token/session storage
4. Create consent UI (login + consent pages)
5. Configure OIDC with FDX scopes
6. Add Docker configuration

### Step 3: Resource Server
1. Create openbanking directory structure
2. Implement token validation middleware
3. Implement scope-checking middleware
4. Create FDX-style API endpoints
5. Add consent verification (only return consented accounts)
6. Add Docker configuration

### Step 4: Infrastructure
1. Update nginx.conf with new subdomains
2. Update docker-compose.yml
3. Update SSL certificates if needed (wildcard should cover *.banksim.ca)

### Step 5: Testing
1. Register a test OAuth client via admin or direct DB
2. Test authorization code flow end-to-end
3. Test API access with valid/invalid tokens
4. Test scope enforcement
5. Test consent revocation

## Security Considerations

1. **Token Storage**: oidc-provider handles secure token storage
2. **PKCE**: Supported by oidc-provider, can enable later
3. **Token Expiration**: Access tokens expire in 1 hour, refresh tokens in 30 days
4. **Consent**: Users explicitly approve each third-party and select accounts
5. **Scope Validation**: Resource server validates scopes on every request
6. **HTTPS Only**: All endpoints require HTTPS
7. **Rate Limiting**: Consider adding rate limiting to prevent abuse

## Future Enhancements

1. **PKCE Support** - Add code_challenge support for mobile/SPA apps
2. **Client Credentials Flow** - For server-to-server access
3. **Dynamic Client Registration** - Allow programmatic client registration
4. **Admin UI for Clients** - Manage OAuth clients in admin dashboard
5. **Consent Management UI** - Let users view/revoke consents in banking app
6. **Audit Logging** - Log all API access for compliance
7. **mTLS** - Full FAPI compliance with mutual TLS
