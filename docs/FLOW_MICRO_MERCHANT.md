# Micro Merchant Payment Flow

QR code and BLE proximity payments for small businesses with automatic fee collection.

## Overview

Micro Merchants are small businesses that accept payments through the mwsim mobile app. Unlike traditional card payments, Micro Merchant payments use TransferSim's P2P infrastructure with automatic platform fee deduction.

## Components

| Component | Role |
|-----------|------|
| **mwsim (Customer)** | Scans QR or discovers merchant via BLE |
| **mwsim (Merchant)** | Displays QR code, receives payments |
| **WSIM** | Wallet backend for both parties |
| **TransferSim** | Routes payment, calculates fees |
| **BSIM** | Bank backend (debits/credits accounts) |
| **BSIM (Fees)** | Platform fee collection account |

## Fee Structure

| Fee Type | Rate | Description |
|----------|------|-------------|
| Platform Fee | 2.0% | Collected on all Micro Merchant transactions |
| Minimum Fee | $0.10 | Minimum fee per transaction |

**Example:** $25.00 payment
- Platform fee: $0.50 (2%)
- Merchant receives: $24.50
- Customer pays: $25.00

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    MICRO MERCHANT PAYMENT FLOW                               │
│                   (QR Code / BLE Proximity Payment)                          │
└──────────────────────────────────────────────────────────────────────────────┘

  CUSTOMER                    MERCHANT                           PLATFORM
 ┌───────┐                   ┌───────┐                          ┌───────┐
 │ mwsim │                   │ mwsim │                          │ BSIM  │
 │  App  │                   │  App  │                          │(Fees) │
 └───┬───┘                   └───┬───┘                          └───────┘
     │                           │
     │ 1. Scan QR / BLE Discovery│
     │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
     │    (merchant token)       │
     │                           │
     │ 2. Confirm Payment        │
     │    ($25.00)               │
     ▼                           │
 ┌───────┐                       │          ┌─────────────┐
 │ WSIM  │──────────────────────────────────│ TransferSim │
 │Backend│  3. POST /merchant-payment       │  (Network)  │
 └───────┘     {merchant_id, amount}        └──────┬──────┘
                                                   │
                                                   │ 4. Calculate fee (2%)
                                                   │    $25.00 -> $0.50 fee
                                                   │
     ┌─────────────────────────────────────────────┤
     │                                             │
     │              ┌──────────┐                   │
     │              │   BSIM   │                   │
     │              │(Customer)│                   │
     │              └────┬─────┘                   │
     │                   │                         │
     │ 5. POST /debit    │                         │
     │    $25.00         │                         │
     ├──────────────────>│                         │
     │                   │                         │
     │    200 OK         │                         │
     │<──────────────────┤                         │
     │                   │                         │
     │              ┌────┴─────┐                   │
     │              │   BSIM   │                   │
     │              │(Merchant)│                   │
     │              └────┬─────┘                   │
     │                   │                         │
     │ 6. POST /credit   │                         │
     │    $24.50 (net)   │                         │
     ├──────────────────>│                         │
     │                   │                         │
     │    200 OK         │                         │
     │<──────────────────┤                         │
     │                   │                         │
     │              ┌────┴─────┐                   │
     │              │   BSIM   │                   │
     │              │  (Fees)  │                   │
     │              └────┬─────┘                   │
     │                   │                         │
     │ 7. POST /credit   │                         │
     │    $0.50 (fee)    │                         │
     ├──────────────────>│                         │
     │                   │                         │
     └───────────────────┤                         │
                         │                         │
                         │ 8. Webhooks             │
     ┌───────────────────┼─────────────────────────┤
     │                   │                         │
     ▼                   ▼                         │
 ┌───────┐          ┌───────┐                      │
 │ WSIM  │          │ WSIM  │                      │
 │(Cust) │          │(Merch)│                      │
 └───┬───┘          └───┬───┘                      │
     │                   │                         │
     │ 9. Push           │ 10. Push                │
     ▼                   ▼                         │
 ┌───────┐          ┌───────┐                      │
 │ mwsim │          │ mwsim │                      │
 └───────┘          └───────┘                      │
     │                   │
     ▼                   ▼
 "Paid $25            "Received
  to Coffee            $24.50 from
  Shop"                @customer"
```

## Step-by-Step

### 1. Merchant Displays Payment Request

Merchant opens mwsim in merchant mode and generates a QR code.

```json
// QR Code contains
{
  "type": "merchant_payment",
  "merchant_id": "merchant_123",
  "merchant_name": "Coffee Shop",
  "amount": 25.00,  // Optional: can be customer-entered
  "token": "pay_abc123xyz"
}
```

### 2. Customer Scans QR / BLE Discovery

Customer scans the QR code or discovers merchant via BLE proximity.

### 3. Initiate Payment (WSIM -> TransferSim)

```json
// Customer's WSIM sends to TransferSim
POST /api/merchant-payments
{
  "customer_bank_id": "bsim",
  "customer_user_id": "user_456",
  "merchant_token": "pay_abc123xyz",
  "amount": 25.00,
  "idempotency_key": "pay_xyz789"
}
```

### 4. Fee Calculation

TransferSim calculates the platform fee:

```javascript
const grossAmount = 25.00;
const feeRate = 0.02;  // 2%
const minFee = 0.10;

const fee = Math.max(grossAmount * feeRate, minFee);  // $0.50
const netAmount = grossAmount - fee;  // $24.50
```

### 5. Debit Customer

```json
// TransferSim -> Customer's BSIM
POST /api/p2p/debit
{
  "user_id": "user_456",
  "amount": 25.00,
  "transfer_id": "payment_001",
  "description": "Payment to Coffee Shop"
}
```

### 6. Credit Merchant (Net Amount)

```json
// TransferSim -> Merchant's BSIM
POST /api/p2p/credit
{
  "user_id": "merchant_123",
  "amount": 24.50,
  "transfer_id": "payment_001",
  "description": "Payment from @customer (net of fees)"
}
```

### 7. Credit Fee Account

```json
// TransferSim -> Platform Fee Account
POST /api/p2p/credit
{
  "user_id": "platform_fees",
  "amount": 0.50,
  "transfer_id": "payment_001",
  "description": "Merchant fee: Coffee Shop payment"
}
```

### 8-10. Webhooks and Notifications

Both parties receive webhooks and push notifications.

```json
// Webhook to merchant's WSIM
{
  "event": "merchant_payment.received",
  "payment_id": "payment_001",
  "gross_amount": 25.00,
  "fee": 0.50,
  "net_amount": 24.50,
  "customer": "@customer",
  "status": "completed"
}
```

## Merchant Registration

### Becoming a Micro Merchant

```json
// Register as merchant via WSIM
POST /api/merchants/register
{
  "business_name": "Coffee Shop",
  "business_type": "food_beverage",
  "tax_id": "123-45-6789",  // Optional
  "logo_url": "https://cdn.banksim.ca/logos/coffee-shop.png"
}

// Response
{
  "merchant_id": "merchant_123",
  "merchant_token": "mch_abc123",
  "fee_rate": 0.02,
  "status": "active"
}
```

### Merchant Profile

Merchants can customize their payment experience:

| Field | Description |
|-------|-------------|
| `business_name` | Displayed to customers |
| `logo_url` | Logo shown on payment screen |
| `default_amount` | Pre-filled payment amount |
| `ble_enabled` | Enable BLE proximity discovery |

## QR Code Formats

### Static QR (No Amount)

Customer enters amount after scanning.

```
transfersim://pay?merchant=merchant_123&token=mch_abc123
```

### Dynamic QR (With Amount)

Amount pre-filled from merchant.

```
transfersim://pay?merchant=merchant_123&token=mch_abc123&amount=25.00
```

## BLE Proximity Mode

Merchants can broadcast their payment token via BLE for contactless discovery.

```
iBeacon Format:
- UUID: TransferSim-Merchant
- Major: bank_id (encoded)
- Minor: merchant_token (encoded)
```

See [BLE Proximity Discovery](FLOW_BLE_DISCOVERY.md) for details.

## Payment States

| State | Description |
|-------|-------------|
| `pending` | Payment initiated |
| `processing` | Fee calculated, debit in progress |
| `completed` | All parties credited |
| `failed` | Payment failed |
| `refunded` | Payment was refunded |

## Refunds

Merchants can initiate refunds within 30 days:

```json
// Merchant initiates refund
POST /api/merchant-payments/:payment_id/refund
{
  "amount": 25.00,  // Full or partial
  "reason": "Customer request"
}
```

**Note:** Platform fees are not refunded.

## Reporting

### Merchant Dashboard

```json
// Daily settlement report
GET /api/merchants/:id/settlements?date=2024-01-15

{
  "date": "2024-01-15",
  "gross_sales": 500.00,
  "total_fees": 10.00,
  "net_settled": 490.00,
  "transaction_count": 20
}
```

## API Endpoints

### TransferSim

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/merchant-payments` | POST | Initiate payment |
| `/api/merchant-payments/:id` | GET | Get payment status |
| `/api/merchant-payments/:id/refund` | POST | Refund payment |
| `/api/merchants/register` | POST | Register as merchant |
| `/api/merchants/:id/settlements` | GET | Settlement reports |

## Security

- Merchant tokens are single-use for dynamic QR
- Static QR tokens can be rate-limited
- Payment amounts validated against merchant limits
- Suspicious activity triggers review

## Related Documentation

- [P2P Transfer Flow](FLOW_P2P_TRANSFER.md) - Standard P2P transfers
- [BLE Proximity Discovery](FLOW_BLE_DISCOVERY.md) - Contactless discovery
- [Card Payment Flow](FLOW_CARD_PAYMENT.md) - Traditional card payments
