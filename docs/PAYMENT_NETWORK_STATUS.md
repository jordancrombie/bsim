# Payment Network Implementation Status

Last Updated: December 2024

## Overview

The Payment Network integration connects three systems:
- **BSIM** (Bank Simulator) - Card issuer, processes payments
- **NSIM** (Network Simulator) - Payment routing middleware
- **SSIM** (Store Simulator) - Merchant, initiates payments

## Phase Status

### Phase 1: Core Payment Network Service ✅ COMPLETE

| Component | Status | Location |
|-----------|--------|----------|
| NSIM Express.js service | ✅ | `/nsim/` |
| Payment API endpoints | ✅ | `/nsim/src/routes/payment.ts` |
| BsimClient HTTP client | ✅ | `/nsim/src/services/bsim-client.ts` |
| PaymentService logic | ✅ | `/nsim/src/services/payment.ts` |
| Docker containerization | ✅ | `/nsim/Dockerfile` |
| nginx proxy config | ✅ | `payment.banksim.ca`, `payment-dev.banksim.ca` |
| Unit tests (60 tests) | ✅ | `/nsim/src/__tests__/` |
| OpenAPI spec | ✅ | `/nsim/openapi.yaml` |

**BSIM-side handler:**
| Component | Status | Location |
|-----------|--------|----------|
| SimNetHandler | ✅ | `/backend/src/payment-network/SimNetHandler.ts` |
| Payment network routes | ✅ | `/backend/src/routes/paymentNetworkRoutes.ts` |
| PaymentConsent model | ✅ | `/auth-server/prisma/schema.prisma` |
| PaymentAuthorization model | ✅ | `/auth-server/prisma/schema.prisma` |

### Phase 2: OAuth Payment Consent ✅ COMPLETE

| Component | Status | Location |
|-----------|--------|----------|
| `payment:authorize` scope | ✅ | `/auth-server/src/config/oidc.ts` |
| Card selection UI | ✅ | `/auth-server/src/views/payment-consent.ejs` |
| Card token generation (`ctok_*`) | ✅ | `/auth-server/src/routes/interaction.ts` |
| Token claims (`card_token`) | ✅ | `/auth-server/src/config/oidc.ts` (extraTokenClaims) |
| SSIM OAuth client config | ✅ | Database: `oauth_clients` |

### Phase 3: SSIM Integration 📋 DOCUMENTED (Waiting for SSIM team)

| Component | Status | Location |
|-----------|--------|----------|
| Integration guide | ✅ | `/nsim/SSIM_INTEGRATION_GUIDE.md` |
| TypeScript interfaces | ✅ | Included in guide |
| SimNetAdapter example | ✅ | Included in guide |
| Dev credentials | ✅ | Included in guide |

### Phase 4: Queue System & Reliability ⏳ NOT STARTED

| Component | Status | Notes |
|-----------|--------|-------|
| Redis queue | ⏳ | For async payment processing |
| Retry logic | ⏳ | Failed payment retries |
| Webhook notifications | ⏳ | Async status updates to merchants |
| Timeout handling | ⏳ | Authorization expiry management |

### Phase 5: Admin & Monitoring ⏳ NOT STARTED

| Component | Status | Notes |
|-----------|--------|-------|
| Payment dashboard | ⏳ | View/search transactions |
| Merchant management | ⏳ | Register/manage merchants |
| Refund management UI | ⏳ | Admin-initiated refunds |
| Analytics | ⏳ | Transaction metrics |

---

## Current Flow (Working)

```
SSIM                          BSIM Auth                    NSIM                         BSIM Backend
  │                              │                           │                              │
  │ 1. Redirect to OAuth         │                           │                              │
  │─────────────────────────────►│                           │                              │
  │                              │                           │                              │
  │                   2. User logs in, selects card          │                              │
  │                              │                           │                              │
  │ 3. Callback with auth code   │                           │                              │
  │◄─────────────────────────────│                           │                              │
  │                              │                           │                              │
  │ 4. Exchange code for token   │                           │                              │
  │─────────────────────────────►│                           │                              │
  │                              │                           │                              │
  │ 5. Access token with         │                           │                              │
  │    card_token claim          │                           │                              │
  │◄─────────────────────────────│                           │                              │
  │                              │                           │                              │
  │ 6. POST /payments/authorize with cardToken               │                              │
  │─────────────────────────────────────────────────────────►│                              │
  │                              │                           │                              │
  │                              │           7. POST /api/payment-network/authorize         │
  │                              │                           │─────────────────────────────►│
  │                              │                           │                              │
  │                              │                           │   8. Validate token,         │
  │                              │                           │      check credit,           │
  │                              │                           │      create auth hold        │
  │                              │                           │                              │
  │                              │                           │   9. Return auth code        │
  │                              │                           │◄─────────────────────────────│
  │                              │                           │                              │
  │ 10. Return transactionId, authCode, status               │                              │
  │◄─────────────────────────────────────────────────────────│                              │
```

---

## Database Tables

### Auth Server (`auth-server/prisma/schema.prisma`)

- **PaymentConsent** - Links card token → user → credit card → merchant
- **PaymentAuthorization** - Tracks authorization holds

### Backend (`backend/prisma/schema.prisma`)

- Uses same schema (shared database)

---

## API Endpoints

### NSIM Public API (for SSIM)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payments/authorize` | Create payment authorization |
| POST | `/api/v1/payments/:id/capture` | Capture authorized payment |
| POST | `/api/v1/payments/:id/void` | Void authorization |
| POST | `/api/v1/payments/:id/refund` | Refund captured payment |
| GET | `/api/v1/payments/:id` | Get transaction status |

### BSIM Internal API (for NSIM)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment-network/authorize` | Process authorization |
| POST | `/api/payment-network/capture` | Process capture |
| POST | `/api/payment-network/void` | Process void |
| POST | `/api/payment-network/refund` | Process refund |
| POST | `/api/payment-network/validate-token` | Validate card token |

---

## Configuration

### NSIM Environment Variables

```env
PORT=3006
NODE_ENV=development
BSIM_BASE_URL=http://backend:3001  # Docker internal
BSIM_API_KEY=dev-payment-api-key
```

### SSIM Environment Variables (for integration)

```env
OAUTH_CLIENT_ID=ssim-client
OAUTH_CLIENT_SECRET=ece9c837b17bface1df34fe89d8c8e13bcf4f9e77c7a7681442952ebd9dd7015
OAUTH_AUTH_URL=https://auth-dev.banksim.ca
PAYMENT_NETWORK_URL=https://payment-dev.banksim.ca
PAYMENT_API_KEY=dev-payment-api-key
```

---

## Test Coverage

### NSIM Unit Tests (60 tests)

- `BsimClient.test.ts` - HTTP client mocking
- `PaymentService.test.ts` - Business logic
- `payment.test.ts` - Route integration tests

Run: `cd nsim && npm test`

---

## What SSIM Needs to Do

1. **Implement OAuth flow** - Redirect to BSIM, handle callback
2. **Extract card_token from JWT** - Decode access token
3. **Call NSIM payment API** - Use the adapter pattern from guide
4. **Handle responses** - Update order status based on payment result
5. **Implement capture** - After order fulfillment
6. **Implement refunds** - For returns/cancellations

---

## Remaining Work

### Short-term (Phase 3 completion)
- [ ] SSIM team implements integration
- [ ] End-to-end testing across all three systems
- [ ] Fix any issues discovered during integration

### Medium-term (Phases 4-5)
- [ ] Add webhook notifications
- [ ] Add retry logic for failed requests
- [ ] Build admin payment dashboard
- [ ] Add merchant management UI

### Future
- [ ] PostgreSQL persistent storage in NSIM (currently in-memory)
- [ ] Redis queue for async processing
- [ ] Rate limiting
- [ ] PCI compliance considerations
