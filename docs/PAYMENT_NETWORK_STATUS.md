# Payment Network Implementation Status

Last Updated: December 3, 2025

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

### Phase 3: SSIM Integration ✅ COMPLETE

| Component | Status | Location |
|-----------|--------|----------|
| Integration guide | ✅ | `/nsim/SSIM_INTEGRATION_GUIDE.md` |
| TypeScript interfaces | ✅ | Included in guide |
| SimNetAdapter example | ✅ | Included in guide |
| Dev credentials | ✅ | Included in guide |
| End-to-end payment flow | ✅ | Tested with SSIM team |

**Integration Issues Resolved (Dec 2024):**
| Issue | Resolution |
|-------|------------|
| Missing nginx proxy for payment-dev | Added `payment-dev.banksim.ca` to `nginx.dev.conf` |
| Invalid redirect_uri | Added `/payment/callback` URIs to ssim-client |
| card_token not in JWT | Fixed Grant ID prefix (`Grant:`) for oidc-provider |
| Merchant mismatch | Merchant ID must match OAuth client_id (`ssim-client`) |
| Amount format | Use decimal dollars (`299.99`), not cents (`29999`) |

### Phase 4: Queue System & Reliability ✅ COMPLETE

| Component | Status | Location |
|-----------|--------|----------|
| Redis container | ✅ | `/docker-compose.yml` (bsim-redis) |
| BullMQ job queue | ✅ | `/nsim/src/queue/webhook-queue.ts` |
| Webhook registration API | ✅ | `/nsim/src/routes/webhook.ts` |
| Webhook delivery | ✅ | `/nsim/src/queue/webhook-queue.ts` |
| Retry logic for BSIM calls | ✅ | `/nsim/src/services/bsim-client.ts` |
| Authorization expiry handling | ✅ | `/nsim/src/queue/expiry-scheduler.ts` |

**New Files (Dec 2024):**
| File | Description |
|------|-------------|
| `/nsim/src/queue/redis.ts` | Redis connection management |
| `/nsim/src/queue/webhook-queue.ts` | BullMQ webhook queue with retry |
| `/nsim/src/queue/expiry-scheduler.ts` | Scheduled auth expiry checks |
| `/nsim/src/services/webhook.ts` | Webhook service (register, notify) |
| `/nsim/src/routes/webhook.ts` | Webhook CRUD API endpoints |
| `/nsim/src/types/webhook.ts` | Webhook TypeScript types |

**Architecture Decisions (Dec 2024):**
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Redis deployment | Separate Docker container | Self-contained, easy to swap for AWS ElastiCache in prod |
| Webhook registration | NSIM API endpoint | Keeps merchant config in payment network |
| Queue library | BullMQ | Mature, TypeScript-native, Redis-backed |
| Implementation order | 1. Webhooks, 2. Retry logic, 3. Timeout handling | Webhooks highest value for merchants |

**Webhook API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhooks` | Register webhook for merchant |
| GET | `/api/v1/webhooks/:id` | Get webhook by ID |
| GET | `/api/v1/webhooks/merchant/:merchantId` | List merchant webhooks |
| PATCH | `/api/v1/webhooks/:id` | Update webhook (url, events, isActive) |
| DELETE | `/api/v1/webhooks/:id` | Delete webhook |

**Webhook Events:**
- `payment.authorized` - Payment authorized successfully
- `payment.captured` - Payment captured
- `payment.voided` - Authorization voided
- `payment.refunded` - Payment refunded
- `payment.declined` - Payment declined
- `payment.expired` - Authorization expired
- `payment.failed` - Payment failed

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

### Open Decisions
- [ ] **Merchant ID flexibility** - Should merchants be able to use a custom merchant ID separate from their OAuth client_id? Options:
  1. Keep current design (merchant ID = client_id) - simplest
  2. Accept custom `merchant_id` parameter in OAuth flow
  3. Add `merchantId` field to OAuthClient table

### Phase 5: Admin & Monitoring
- [ ] Build admin payment dashboard
- [ ] Add merchant management UI
- [ ] Add refund management UI
- [ ] Add payment analytics

### Future
- [ ] PostgreSQL persistent storage in NSIM (currently in-memory)
- [ ] Rate limiting
- [ ] PCI compliance considerations
