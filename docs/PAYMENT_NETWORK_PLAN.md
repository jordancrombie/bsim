# Payment Network Integration Plan

## Overview

This document outlines the architecture and implementation plan for adding a **Payment Network** to connect BSIM (Bank Simulator) and SSIM (Store Simulator). The payment network acts as middleware that routes payment authorization requests between merchants (SSIM) and banks (BSIM).

## Architecture Vision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SSIM (Store Simulator)                         │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────────────────┐    │
│  │   Store UI      │    │         Payment Network Plugin               │    │
│  │                 │    │  ┌─────────────────────────────────────────┐ │    │
│  │  - Product list │    │  │  IPaymentNetworkAdapter                 │ │    │
│  │  - Cart         │◄───┤  │  - submitPayment()                      │ │    │
│  │  - Checkout     │    │  │  - checkPaymentStatus()                 │ │    │
│  │                 │    │  │  - cancelPayment()                      │ │    │
│  └─────────────────┘    │  └─────────────────────────────────────────┘ │    │
│                         │                    │                          │    │
│                         │  Implementations:  │                          │    │
│                         │  - SimNetAdapter   │ (default simulator net)  │    │
│                         │  - VisaAdapter     │ (future)                 │    │
│                         │  - MCAdapter       │ (future)                 │    │
│                         └────────────────────┼──────────────────────────┘    │
└──────────────────────────────────────────────┼──────────────────────────────┘
                                               │
                                               │ HTTPS + OAuth 2.0
                                               │
┌──────────────────────────────────────────────▼──────────────────────────────┐
│                         Payment Network (SimNet)                            │
│                         payment.yourbanksimdomain.com:3006                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Payment Queue Service                           │   │
│  │                                                                      │   │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐        │   │
│  │  │ Pending Queue │ ─► │ Processing    │ ─► │ Completed     │        │   │
│  │  │               │    │               │    │ /Declined     │        │   │
│  │  └───────────────┘    └───────────────┘    └───────────────┘        │   │
│  │                              │                                       │   │
│  │                              ▼                                       │   │
│  │                    ┌─────────────────┐                               │   │
│  │                    │ Bank Router     │                               │   │
│  │                    │ - Route by BIN  │                               │   │
│  │                    │ - Lookup issuer │                               │   │
│  │                    └─────────────────┘                               │   │
│  │                              │                                       │   │
│  └──────────────────────────────┼───────────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                                  │ Internal API (mTLS)
                                  │
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                          BSIM (Bank Simulator)                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Payment Network Plugin                            │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐│   │
│  │  │  IPaymentNetworkHandler                                         ││   │
│  │  │  - handleAuthorizationRequest()                                 ││   │
│  │  │  - handleCaptureRequest()                                       ││   │
│  │  │  - handleRefundRequest()                                        ││   │
│  │  │  - handleVoidRequest()                                          ││   │
│  │  └─────────────────────────────────────────────────────────────────┘│   │
│  │                              │                                       │   │
│  │  Implementations:            │                                       │   │
│  │  - SimNetHandler             │ (default simulator network)           │   │
│  │  - VisaNetHandler            │ (future Visa Direct)                  │   │
│  │                              │                                       │   │
│  └──────────────────────────────┼───────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Internal Banking Services                         │   │
│  │                                                                      │   │
│  │  CreditCardService          AccountService                          │   │
│  │  - charge()                 - withdraw()                            │   │
│  │  - authorize()              - checkBalance()                        │   │
│  │  - capture()                                                        │   │
│  │  - refund()                                                         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Payment Flow

### 1. Authorization Request Flow

```
1. Customer at SSIM checkout selects "Pay with Card"
2. SSIM uses OAuth 2.0 to get payment token (via BSIM auth-server)
   - User authenticates with BSIM passkey
   - User consents to payment scope
   - SSIM receives access token with payment permissions
3. SSIM submits payment request to Payment Network
   POST https://payment.yourbanksimdomain.com/api/v1/payments
   {
     "merchantId": "ssim-store-001",
     "amount": 125.99,
     "currency": "CAD",
     "cardToken": "tok_xxx",  // Tokenized card from OAuth consent
     "orderId": "order-12345",
     "description": "Store purchase"
   }
4. Payment Network queues request
5. Payment Network routes to BSIM based on card BIN
6. BSIM Payment Handler receives request
7. BSIM validates:
   - Card exists and is active
   - Sufficient credit/balance
   - Card not expired
   - User authorized this payment (via OAuth token)
8. BSIM authorizes and holds funds
9. Response flows back through queue
10. SSIM receives authorization response
    {
      "paymentId": "pay_abc123",
      "status": "AUTHORIZED",
      "authorizationCode": "AUTH123",
      "availableCredit": 4874.01
    }
```

### 2. Capture Flow (Settlement)

```
1. SSIM ships order / completes service
2. SSIM captures payment
   POST https://payment.yourbanksimdomain.com/api/v1/payments/{paymentId}/capture
3. Payment Network forwards to BSIM
4. BSIM completes the charge (auth → settled)
5. Transaction recorded in BSIM
6. SSIM receives confirmation
```

### 3. Refund Flow

```
1. Customer requests refund at SSIM
2. SSIM initiates refund
   POST https://payment.yourbanksimdomain.com/api/v1/payments/{paymentId}/refund
   { "amount": 125.99, "reason": "Customer return" }
3. Payment Network routes to BSIM
4. BSIM processes refund to card
5. Credit restored to customer's card
6. SSIM receives refund confirmation
```

---

## Component Specifications

### 1. Payment Network Service (New Service)

**Location:** `/payment-network/` (new directory at BSIM repo root)

**Technology Stack:**
- Node.js + Express + TypeScript (matches BSIM patterns)
- PostgreSQL (shared database with BSIM)
- Redis (optional, for queue management)
- JWT validation (validates tokens from auth-server)

**Database Models:**

```prisma
// Add to shared prisma/schema.prisma

model PaymentTransaction {
  id                String              @id @default(uuid())
  paymentId         String              @unique  // External payment ID (pay_xxx)
  merchantId        String
  merchantName      String?

  // Amount details
  amount            Decimal             @db.Decimal(15, 2)
  currency          String              @default("CAD")

  // Card details (tokenized)
  cardToken         String              // Reference to user's card consent
  cardLast4         String              // Last 4 digits for display
  cardBrand         String              // VISA, MC, AMEX

  // Status tracking
  status            PaymentStatus       @default(PENDING)
  authorizationCode String?
  declineReason     String?

  // Timestamps
  authorizedAt      DateTime?
  capturedAt        DateTime?
  refundedAt        DateTime?
  voidedAt          DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  // Relations
  bankTransactionId String?             // Link to BSIM transaction
  merchantOrderId   String?             // SSIM's order reference

  @@map("payment_transactions")
}

enum PaymentStatus {
  PENDING
  AUTHORIZED
  CAPTURED
  DECLINED
  REFUNDED
  VOIDED
  EXPIRED
}

model PaymentMerchant {
  id            String    @id @default(uuid())
  merchantId    String    @unique  // External merchant ID
  name          String
  mccCode       String?   // Merchant Category Code
  webhookUrl    String?   // For async notifications
  apiKey        String    // For merchant authentication
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("payment_merchants")
}
```

**API Endpoints:**

```
# Payment Network Public API (for SSIM)
POST   /api/v1/payments                    # Create payment authorization
GET    /api/v1/payments/:paymentId         # Get payment status
POST   /api/v1/payments/:paymentId/capture # Capture authorized payment
POST   /api/v1/payments/:paymentId/refund  # Refund captured payment
POST   /api/v1/payments/:paymentId/void    # Void authorized payment

# Webhook endpoints (for async notifications)
POST   /api/v1/webhooks/register           # Register merchant webhook
DELETE /api/v1/webhooks/:webhookId         # Remove webhook

# Admin endpoints (internal)
GET    /api/v1/admin/payments              # List all payments
GET    /api/v1/admin/merchants             # List merchants
POST   /api/v1/admin/merchants             # Register merchant
```

### 2. BSIM Payment Handler Plugin

**Location:** `/backend/src/payment-network/` (new directory)

**Interface Definition:**

```typescript
// /backend/src/payment-network/interfaces/IPaymentNetworkHandler.ts

export interface PaymentAuthorizationRequest {
  paymentId: string;
  cardToken: string;           // OAuth-consented card token
  amount: number;
  currency: string;
  merchantId: string;
  merchantName: string;
  mccCode?: string;
  orderId?: string;
  description?: string;
  userId: string;              // From OAuth token's sub claim
}

export interface PaymentAuthorizationResponse {
  success: boolean;
  authorizationCode?: string;
  declineReason?: string;
  transactionId?: string;      // BSIM internal transaction ID
  availableCredit?: number;
}

export interface PaymentCaptureRequest {
  paymentId: string;
  authorizationCode: string;
  amount?: number;             // Optional partial capture
}

export interface PaymentRefundRequest {
  paymentId: string;
  amount: number;
  reason?: string;
}

export interface IPaymentNetworkHandler {
  /**
   * Handle authorization request from payment network
   */
  handleAuthorizationRequest(
    request: PaymentAuthorizationRequest
  ): Promise<PaymentAuthorizationResponse>;

  /**
   * Handle capture request (settle authorized payment)
   */
  handleCaptureRequest(
    request: PaymentCaptureRequest
  ): Promise<{ success: boolean; transactionId?: string }>;

  /**
   * Handle refund request
   */
  handleRefundRequest(
    request: PaymentRefundRequest
  ): Promise<{ success: boolean; refundId?: string }>;

  /**
   * Handle void request (cancel authorization)
   */
  handleVoidRequest(
    paymentId: string
  ): Promise<{ success: boolean }>;
}
```

**SimNet Handler Implementation:**

```typescript
// /backend/src/payment-network/handlers/SimNetHandler.ts

export class SimNetHandler implements IPaymentNetworkHandler {
  constructor(
    private creditCardService: CreditCardService,
    private accountService: AccountService,
    private consentRepository: IConsentRepository
  ) {}

  async handleAuthorizationRequest(
    request: PaymentAuthorizationRequest
  ): Promise<PaymentAuthorizationResponse> {
    // 1. Validate card token against user's consented cards
    const consent = await this.consentRepository.findByToken(request.cardToken);
    if (!consent || consent.userId !== request.userId) {
      return { success: false, declineReason: 'INVALID_TOKEN' };
    }

    // 2. Get card details from consent
    const cardNumber = consent.cardNumber;

    // 3. Call existing credit card service to authorize
    try {
      const result = await this.creditCardService.authorize(
        cardNumber,
        request.amount,
        request.merchantName,
        request.mccCode
      );

      return {
        success: true,
        authorizationCode: result.authorizationCode,
        transactionId: result.transactionId,
        availableCredit: result.availableCredit
      };
    } catch (error) {
      return {
        success: false,
        declineReason: this.mapErrorToDeclineReason(error)
      };
    }
  }

  // ... other methods
}
```

### 3. SSIM Payment Network Plugin

**Interface for SSIM to implement:**

```typescript
// This interface would live in SSIM codebase

export interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  description?: string;
  customerEmail?: string;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'AUTHORIZED' | 'DECLINED' | 'PENDING';
  authorizationCode?: string;
  declineReason?: string;
  message?: string;
}

export interface IPaymentNetworkAdapter {
  /**
   * Initialize the adapter with credentials
   */
  initialize(config: {
    merchantId: string;
    apiKey: string;
    baseUrl: string;
  }): Promise<void>;

  /**
   * Submit a payment for authorization
   * @param cardToken - Token from OAuth consent flow
   * @param request - Payment details
   */
  submitPayment(
    cardToken: string,
    request: PaymentRequest
  ): Promise<PaymentResponse>;

  /**
   * Check payment status
   */
  checkPaymentStatus(paymentId: string): Promise<PaymentResponse>;

  /**
   * Capture an authorized payment
   */
  capturePayment(
    paymentId: string,
    amount?: number
  ): Promise<{ success: boolean }>;

  /**
   * Refund a captured payment
   */
  refundPayment(
    paymentId: string,
    amount: number,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string }>;

  /**
   * Void an authorized payment
   */
  voidPayment(paymentId: string): Promise<{ success: boolean }>;
}
```

**SimNet Adapter Implementation for SSIM:**

```typescript
// SSIM codebase: /src/payment/adapters/SimNetAdapter.ts

export class SimNetAdapter implements IPaymentNetworkAdapter {
  private merchantId: string;
  private apiKey: string;
  private baseUrl: string;

  async initialize(config: {
    merchantId: string;
    apiKey: string;
    baseUrl: string;
  }): Promise<void> {
    this.merchantId = config.merchantId;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  async submitPayment(
    cardToken: string,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Id': this.merchantId,
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        cardToken,
        amount: request.amount,
        currency: request.currency,
        orderId: request.orderId,
        description: request.description,
      }),
    });

    return response.json();
  }

  // ... other methods
}
```

---

## OAuth Integration for Payments

### New Payment Scope

Add to auth-server scopes:

```typescript
const PAYMENT_SCOPES = [
  'payment:authorize',    // Authorize single payment
  'payment:recurring',    // Set up recurring payments (future)
];
```

### Card Token Consent Flow

1. **SSIM initiates payment:**
   ```
   GET https://auth.yourbanksimdomain.com/auth
   ?client_id=ssim-store
   &redirect_uri=https://ssim.yourbanksimdomain.com/payment/callback
   &response_type=code
   &scope=openid payment:authorize
   &state=order-12345
   ```

2. **User sees consent screen:**
   - "SSIM Store wants to charge your card"
   - Select which card to use
   - See amount and merchant
   - Approve/Deny

3. **On approval:**
   - Auth server creates consent record with selected card
   - Issues authorization code
   - SSIM exchanges for access token
   - Token contains `cardToken` claim for the selected card

4. **SSIM uses token for payment:**
   - Extract `cardToken` from JWT claims
   - Submit to payment network with token

---

## Implementation Phases

### Phase 1: Core Payment Network Service (BSIM Side)
**Duration:** 2-3 weeks

1. Create `/payment-network/` service structure
2. Add database models to Prisma schema
3. Implement basic payment API endpoints
4. Create SimNetHandler in backend
5. Add payment authorization to CreditCardService
6. Unit tests for payment flow
7. Docker & nginx configuration

### Phase 2: OAuth Payment Consent (BSIM Side)
**Duration:** 1-2 weeks

1. Add `payment:authorize` scope to auth-server
2. Create card selection consent UI
3. Generate card tokens on consent
4. Update token claims to include card token
5. Token validation in payment network

### Phase 3: SSIM Integration
**Duration:** 2-3 weeks (SSIM team)

1. Create IPaymentNetworkAdapter interface
2. Implement SimNetAdapter
3. Add payment flow to checkout
4. Handle payment responses
5. Order status updates based on payment status

### Phase 4: Queue System & Reliability
**Duration:** 2-3 weeks

1. Add Redis for payment queue (optional)
2. Implement retry logic
3. Add webhook notifications
4. Payment status polling
5. Timeout handling

### Phase 5: Admin & Monitoring
**Duration:** 1-2 weeks

1. Payment dashboard in admin portal
2. Transaction search and filtering
3. Refund management UI
4. Merchant management
5. Payment analytics

---

## Configuration

### Environment Variables

**Payment Network Service:**
```env
# Database
DATABASE_URL=postgresql://...

# Auth Server (for token validation)
AUTH_SERVER_URL=https://auth.yourbanksimdomain.com
AUTH_SERVER_JWKS_URL=https://auth.yourbanksimdomain.com/.well-known/jwks.json

# BSIM Backend (for bank operations)
BSIM_BACKEND_URL=http://backend:3001
BSIM_INTERNAL_API_KEY=internal-api-key

# Service
PORT=3006
NODE_ENV=production
```

**SSIM Configuration:**
```env
# Payment Network
PAYMENT_NETWORK_URL=https://payment.yourbanksimdomain.com
PAYMENT_MERCHANT_ID=ssim-store-001
PAYMENT_API_KEY=merchant-api-key

# OAuth (existing)
OAUTH_CLIENT_ID=ssim-store
OAUTH_CLIENT_SECRET=...
OAUTH_AUTH_URL=https://auth.yourbanksimdomain.com
```

### Docker Compose Addition

```yaml
# Add to docker-compose.yml

payment-network:
  build:
    context: ./payment-network
    dockerfile: Dockerfile
  container_name: bsim-payment-network
  environment:
    - DATABASE_URL=${DATABASE_URL}
    - AUTH_SERVER_URL=http://auth-server:3003
    - BSIM_BACKEND_URL=http://backend:3001
    - PORT=3006
    - NODE_ENV=production
  ports:
    - "3006:3006"
  depends_on:
    - db
    - auth-server
    - backend
  networks:
    - bsim-network
  restart: unless-stopped
```

### Nginx Addition

```nginx
# Add to nginx.conf

# Payment Network API
server {
    listen 443 ssl;
    server_name payment.yourbanksimdomain.com;

    ssl_certificate /etc/nginx/certs/yourbanksimdomain.com.crt;
    ssl_certificate_key /etc/nginx/certs/yourbanksimdomain.com.key;

    location / {
        proxy_pass http://payment-network:3006;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Security Considerations

1. **Token Validation:** All payment requests must include valid OAuth token
2. **Card Tokenization:** Never expose raw card numbers to SSIM
3. **Merchant Authentication:** API key + merchant ID for all requests
4. **Rate Limiting:** Protect against brute force
5. **Audit Logging:** Log all payment attempts
6. **Encryption:** TLS for all communications
7. **PCI Considerations:** Card data stays within BSIM network

---

## Testing Strategy

1. **Unit Tests:** Service methods, handlers, validators
2. **Integration Tests:** Full payment flow with test cards
3. **E2E Tests:** SSIM → Payment Network → BSIM → Response
4. **Load Tests:** Concurrent payment processing
5. **Security Tests:** Token validation, authorization checks

---

## API Documentation

Full OpenAPI/Swagger documentation will be generated and available at:
- `https://payment.yourbanksimdomain.com/docs`

---

## Summary for SSIM Team

**What SSIM needs to implement:**

1. **IPaymentNetworkAdapter interface** - Abstract payment operations
2. **SimNetAdapter class** - HTTP client for payment.yourbanksimdomain.com
3. **Checkout integration** - Call adapter during checkout
4. **OAuth flow update** - Request `payment:authorize` scope
5. **Card selection UI** - Let user pick card during OAuth consent
6. **Payment status handling** - Update order based on payment response
7. **Webhook handler** (optional) - Receive async payment notifications

**Endpoints SSIM will call:**
- `POST /api/v1/payments` - Submit payment
- `GET /api/v1/payments/:id` - Check status
- `POST /api/v1/payments/:id/capture` - Capture
- `POST /api/v1/payments/:id/refund` - Refund

**Authentication:**
- OAuth 2.0 access token in `Authorization: Bearer <token>` header
- Merchant credentials in `X-Merchant-Id` and `X-API-Key` headers
