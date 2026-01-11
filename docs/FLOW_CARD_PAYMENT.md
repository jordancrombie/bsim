# Card Payment Flow

E-commerce card payments via NSIM payment network with OAuth-based card selection.

## Overview

Card payments allow merchants (SSIM) to charge customers' BSIM cards through the NSIM payment network. The flow uses OAuth 2.0 for secure card selection, with WSIM acting as the authorization server.

## Components

| Component | Role |
|-----------|------|
| **Browser** | Customer's web browser |
| **SSIM** | Merchant store (e-commerce site) |
| **WSIM** | Wallet/authorization server |
| **NSIM** | Card payment network |
| **BSIM** | Card-issuing bank |

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CARD PAYMENT FLOW                                     │
│                    (E-commerce via NSIM Network)                             │
└──────────────────────────────────────────────────────────────────────────────┘

  CUSTOMER               MERCHANT                NETWORK              ISSUER
 ┌───────┐              ┌───────┐              ┌───────┐            ┌───────┐
 │Browser│              │ SSIM  │              │ NSIM  │            │ BSIM  │
 └───┬───┘              │(Store)│              │(Card  │            │(Card  │
     │                  └───┬───┘              │Network│            │Issuer)│
     │                      │                  └───┬───┘            └───┬───┘
     │ 1. Add to Cart       │                      │                    │
     │    & Checkout        │                      │                    │
     ├─────────────────────>│                      │                    │
     │                      │                      │                    │
     │ 2. Redirect to       │                      │                    │
     │    WSIM OAuth        │                      │                    │
     │<─────────────────────┤                      │                    │
     │                      │                      │                    │
     ▼                      │                      │                    │
 ┌───────┐                  │                      │                    │
 │ WSIM  │                  │                      │                    │
 │ Auth  │                  │                      │                    │
 └───┬───┘                  │                      │                    │
     │                      │                      │                    │
     │ 3. Login &           │                      │                    │
     │    Select Card       │                      │                    │
     │    (Passkey Auth)    │                      │                    │
     │                      │                      │                    │
     │ 4. OAuth Callback    │                      │                    │
     │    (card token)      │                      │                    │
     ├─────────────────────>│                      │                    │
     │                      │                      │                    │
     │                      │ 5. POST /authorize   │                    │
     │                      │    {token, amount}   │                    │
     │                      ├─────────────────────>│                    │
     │                      │                      │                    │
     │                      │                      │ 6. Decode token    │
     │                      │                      │    & validate      │
     │                      │                      │                    │
     │                      │                      │ 7. POST /authorize │
     │                      │                      │    (card details)  │
     │                      │                      ├───────────────────>│
     │                      │                      │                    │
     │                      │                      │    8. Check balance│
     │                      │                      │       Place hold   │
     │                      │                      │                    │
     │                      │                      │    200 {auth_code} │
     │                      │                      │<───────────────────┤
     │                      │                      │                    │
     │                      │    200 {auth_code}   │                    │
     │                      │<─────────────────────┤                    │
     │                      │                      │                    │
     │  9. "Order Placed!"  │                      │                    │
     │<─────────────────────┤                      │                    │
     │                      │                      │                    │
     │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
     │                      │ (Later: Fulfillment) │                    │
     │                      │                      │                    │
     │                      │ 10. POST /capture    │                    │
     │                      │     {auth_code}      │                    │
     │                      ├─────────────────────>│                    │
     │                      │                      │                    │
     │                      │                      │ 11. POST /capture  │
     │                      │                      ├───────────────────>│
     │                      │                      │                    │
     │                      │                      │    Convert hold    │
     │                      │                      │    to charge       │
     │                      │                      │                    │
     │                      │                      │    200 OK          │
     │                      │                      │<───────────────────┤
     │                      │                      │                    │
     │                      │    200 OK            │                    │
     │                      │<─────────────────────┤                    │
     │                      │                      │                    │
     │  12. Webhook:        │                      │                    │
     │      CAPTURED        │                      │                    │
     │<─────────────────────┤                      │                    │
```

## Step-by-Step

### 1. Customer Checkout

Customer adds items to cart and proceeds to checkout on SSIM.

### 2. OAuth Redirect to WSIM

SSIM redirects customer to WSIM for card selection.

```
GET https://wsim.banksim.ca/oauth/authorize
  ?client_id=ssim_store_123
  &redirect_uri=https://store.example.com/callback
  &response_type=code
  &scope=payment
  &state=order_789
  &amount=99.99
  &currency=CAD
```

### 3. Customer Authenticates and Selects Card

Customer logs into WSIM using passkey authentication and selects which enrolled card to use.

```
┌─────────────────────────────────────┐
│         WSIM Wallet                 │
│                                     │
│  Select a card for payment:         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💳 BSIM Platinum            │   │
│  │    **** **** **** 4242      │   │
│  │    Expires 12/26            │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💳 NewBank Gold             │   │
│  │    **** **** **** 1234      │   │
│  │    Expires 08/25            │   │
│  └─────────────────────────────┘   │
│                                     │
│  Amount: $99.99 CAD                 │
│  Merchant: Example Store            │
│                                     │
│         [Authorize Payment]         │
└─────────────────────────────────────┘
```

### 4. OAuth Callback with Token

WSIM redirects back to SSIM with an authorization code.

```
GET https://store.example.com/callback
  ?code=auth_code_xyz
  &state=order_789
```

SSIM exchanges code for a payment token:

```json
// SSIM -> WSIM
POST /oauth/token
{
  "grant_type": "authorization_code",
  "code": "auth_code_xyz",
  "client_id": "ssim_store_123",
  "client_secret": "secret_abc",
  "redirect_uri": "https://store.example.com/callback"
}

// Response
{
  "access_token": "pay_token_123",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "payment"
}
```

### 5. Authorize Payment (SSIM -> NSIM)

```json
// SSIM -> NSIM
POST /api/v1/payments/authorize
{
  "payment_token": "pay_token_123",
  "amount": 99.99,
  "currency": "CAD",
  "merchant_id": "ssim_store_123",
  "order_id": "order_789",
  "description": "Example Store Purchase"
}
```

### 6-7. NSIM Routes to Issuing Bank

NSIM decodes the token to identify the card and issuing bank, then forwards the authorization request.

```json
// NSIM -> BSIM
POST /api/payment-network/authorize
{
  "card_id": "card_456",
  "amount": 99.99,
  "currency": "CAD",
  "merchant": {
    "id": "ssim_store_123",
    "name": "Example Store",
    "category": "5411"
  },
  "transaction_id": "txn_nsim_001"
}
```

### 8. BSIM Places Hold

BSIM validates the card, checks available balance/credit, and places a hold.

```json
// BSIM Response
{
  "authorized": true,
  "authorization_code": "AUTH123456",
  "available_credit": 900.01,
  "hold_amount": 99.99,
  "expires_at": "2024-01-22T12:00:00Z"
}
```

### 9. Order Confirmation

Customer sees order confirmation on SSIM.

### 10-11. Capture Payment (Fulfillment)

When merchant ships the order, they capture the payment.

```json
// SSIM -> NSIM
POST /api/v1/payments/capture
{
  "authorization_code": "AUTH123456",
  "amount": 99.99,  // Can be less than authorized
  "final": true
}

// NSIM -> BSIM
POST /api/payment-network/capture
{
  "authorization_code": "AUTH123456",
  "amount": 99.99
}
```

### 12. Webhook Notification

NSIM sends webhook to SSIM confirming capture.

```json
// Webhook to SSIM
POST /webhooks/nsim
{
  "event": "payment.captured",
  "payment_id": "pay_001",
  "authorization_code": "AUTH123456",
  "amount": 99.99,
  "status": "captured",
  "timestamp": "2024-01-16T14:30:00Z"
}
```

## Payment Operations

### Authorization

Places a hold on funds without charging.

```json
POST /api/v1/payments/authorize
{
  "payment_token": "...",
  "amount": 99.99
}
```

### Capture

Converts hold to actual charge. Can be partial.

```json
POST /api/v1/payments/capture
{
  "authorization_code": "AUTH123456",
  "amount": 99.99
}
```

### Void

Releases hold without charging (before capture).

```json
POST /api/v1/payments/void
{
  "authorization_code": "AUTH123456"
}
```

### Refund

Returns funds after capture.

```json
POST /api/v1/payments/refund
{
  "payment_id": "pay_001",
  "amount": 50.00,  // Partial refund
  "reason": "Customer return"
}
```

## Payment States

```
┌─────────────┐
│  INITIATED  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│ AUTHORIZED  │────>│   VOIDED    │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  CAPTURED   │────>│  REFUNDED   │
└─────────────┘     │  (partial)  │
                    └─────────────┘
```

| State | Description |
|-------|-------------|
| `initiated` | Payment request received |
| `authorized` | Hold placed on funds |
| `captured` | Funds transferred to merchant |
| `voided` | Authorization cancelled |
| `refunded` | Funds returned (full or partial) |
| `declined` | Authorization denied |

## Decline Codes

| Code | Description |
|------|-------------|
| `insufficient_funds` | Not enough balance/credit |
| `card_expired` | Card has expired |
| `card_blocked` | Card is blocked/frozen |
| `invalid_card` | Card number invalid |
| `fraud_suspected` | Flagged by fraud detection |
| `limit_exceeded` | Transaction limit exceeded |

## API Endpoints

### NSIM (Payment Network)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/payments/authorize` | POST | Authorize payment |
| `/api/v1/payments/capture` | POST | Capture authorized payment |
| `/api/v1/payments/void` | POST | Void authorization |
| `/api/v1/payments/refund` | POST | Refund captured payment |
| `/api/v1/payments/:id` | GET | Get payment status |

### BSIM (Issuing Bank)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payment-network/authorize` | POST | Process authorization |
| `/api/payment-network/capture` | POST | Process capture |
| `/api/payment-network/void` | POST | Process void |
| `/api/payment-network/refund` | POST | Process refund |

### WSIM (Wallet/Auth Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/authorize` | GET | OAuth authorization endpoint |
| `/oauth/token` | POST | Exchange code for token |
| `/api/cards` | GET | List enrolled cards |

## Security

- Payment tokens are short-lived (1 hour)
- All communication over TLS
- Webhooks signed with HMAC
- PCI DSS compliance required for card data handling
- Card numbers never exposed to merchants

## Related Documentation

- [NSIM Production Deployment](NSIM_PRODUCTION_DEPLOYMENT.md) - Network setup
- [WSIM Integration](../wsim/README.md) - Wallet setup
- [OpenBanking](FLOW_OPENBANKING.md) - Account data access
