# P2P Transfer Flow

Cross-bank peer-to-peer transfers via TransferSim network.

## Overview

P2P transfers allow users to send money instantly to any other user by their alias (email, phone, or username). TransferSim acts as the central routing network, coordinating debits and credits across different bank instances (BSIM, NewBank).

## Components

| Component | Role |
|-----------|------|
| **mwsim** | Mobile wallet app (sender/receiver UI) |
| **WSIM** | Wallet backend (initiates transfers) |
| **TransferSim** | P2P network (routes transfers, manages state) |
| **BSIM** | Bank backend (debits/credits accounts) |

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         P2P TRANSFER FLOW                                    │
│                    (Cross-Bank via TransferSim)                              │
└──────────────────────────────────────────────────────────────────────────────┘

  SENDER                                                              RECEIVER
 ┌───────┐                                                           ┌───────┐
 │ mwsim │                                                           │ mwsim │
 │  App  │                                                           │  App  │
 └───┬───┘                                                           └───┬───┘
     │                                                                   │
     │ 1. Initiate Transfer                                              │
     │    (recipient alias, amount)                                      │
     ▼                                                                   │
 ┌───────┐          ┌─────────────┐          ┌─────────┐                │
 │ WSIM  │─────────>│ TransferSim │          │  BSIM   │                │
 │Backend│  2. POST │  (Network)  │          │(Sender) │                │
 └───────┘  /transfer└─────┬───────┘          └────┬────┘                │
                           │                       │                     │
                           │ 3. Lookup recipient   │                     │
                           │    by alias           │                     │
                           │    ───────────────────┼──────────────────>  │
                           │                       │              ┌──────┴──────┐
                           │                       │              │    BSIM     │
                           │ 4. POST /debit        │              │  (Receiver) │
                           │    (sender account)   │              └──────┬──────┘
                           ├──────────────────────>│                     │
                           │                       │                     │
                           │      200 OK (debited) │                     │
                           │<──────────────────────┤                     │
                           │                       │                     │
                           │ 5. POST /credit       │                     │
                           │    (receiver account) │                     │
                           ├─────────────────────────────────────────────>
                           │                       │                     │
                           │                       │     200 OK (credited)
                           │<─────────────────────────────────────────────
                           │                       │                     │
                           │ 6. Webhook: COMPLETED │                     │
     ┌─────────────────────┤                       │                     │
     │                     │                       │                     │
     ▼                     │ 7. Webhook: RECEIVED  │                     │
 ┌───────┐                 ├─────────────────────────────────────────────>
 │ WSIM  │                 │                       │                     │
 │Backend│                 │                       │                     ▼
 └───┬───┘                 │                       │                 ┌───────┐
     │                     │                       │                 │ WSIM  │
     │ 8. Push             │                       │                 │Backend│
     │    Notification     │                       │                 └───┬───┘
     ▼                     │                       │                     │
 ┌───────┐                 │                       │              9. Push│
 │ mwsim │                 │                       │           Notification
 │  App  │                 │                       │                     ▼
 └───────┘                 │                       │                 ┌───────┐
     │                     │                       │                 │ mwsim │
     ▼                     │                       │                 │  App  │
 "Transfer                 │                       │                 └───────┘
  Sent!"                   │                       │                     │
                           │                       │                     ▼
                           │                       │              "You received
                           │                       │               $50 from
                           │                       │               @sender!"
```

## Step-by-Step

### 1. Initiate Transfer (mwsim -> WSIM)

User enters recipient alias and amount in the mobile app.

```json
// mwsim sends to WSIM
POST /api/transfers
{
  "recipient_alias": "@alice",
  "amount": 50.00,
  "note": "Lunch money"
}
```

### 2. Forward to TransferSim (WSIM -> TransferSim)

WSIM validates the user session and forwards to TransferSim.

```json
// WSIM sends to TransferSim
POST /api/transfers
{
  "sender_bank_id": "bsim",
  "sender_user_id": "user_123",
  "recipient_alias": "@alice",
  "amount": 50.00,
  "note": "Lunch money",
  "idempotency_key": "txn_abc123"
}
```

### 3. Lookup Recipient

TransferSim resolves the alias to find which bank the recipient belongs to.

```json
// TransferSim queries recipient bank
GET /api/users/resolve?alias=@alice

// Response
{
  "user_id": "user_456",
  "bank_id": "newbank",
  "display_name": "Alice Smith"
}
```

### 4. Debit Sender (TransferSim -> Sender's BSIM)

```json
// TransferSim calls sender's bank
POST /api/p2p/debit
{
  "user_id": "user_123",
  "amount": 50.00,
  "transfer_id": "transfer_789",
  "description": "P2P to @alice"
}

// Response
{
  "success": true,
  "transaction_id": "txn_sender_001",
  "new_balance": 450.00
}
```

### 5. Credit Receiver (TransferSim -> Receiver's BSIM)

```json
// TransferSim calls receiver's bank
POST /api/p2p/credit
{
  "user_id": "user_456",
  "amount": 50.00,
  "transfer_id": "transfer_789",
  "description": "P2P from @sender"
}

// Response
{
  "success": true,
  "transaction_id": "txn_receiver_001",
  "new_balance": 550.00
}
```

### 6-7. Webhooks to Both Parties

TransferSim sends webhooks to notify both WSIM instances.

```json
// Webhook to sender's WSIM
POST /webhooks/transfersim
{
  "event": "transfer.completed",
  "transfer_id": "transfer_789",
  "direction": "outgoing",
  "amount": 50.00,
  "recipient": "@alice",
  "status": "completed"
}

// Webhook to receiver's WSIM
POST /webhooks/transfersim
{
  "event": "transfer.received",
  "transfer_id": "transfer_789",
  "direction": "incoming",
  "amount": 50.00,
  "sender": "@sender",
  "status": "completed"
}
```

### 8-9. Push Notifications

Each WSIM sends push notifications to the respective mobile apps.

## Transfer States

| State | Description |
|-------|-------------|
| `pending` | Transfer initiated, awaiting processing |
| `debited` | Sender's account debited successfully |
| `completed` | Receiver credited, transfer complete |
| `failed` | Transfer failed (insufficient funds, invalid recipient) |
| `reversed` | Transfer was reversed/refunded |

## Error Handling

### Insufficient Funds

```json
// Debit fails
{
  "error": "insufficient_funds",
  "available_balance": 25.00,
  "requested_amount": 50.00
}
```

TransferSim marks transfer as `failed` and notifies sender.

### Recipient Not Found

```json
// Alias lookup fails
{
  "error": "recipient_not_found",
  "alias": "@unknown_user"
}
```

### Partial Failure (Credit Failed After Debit)

If credit fails after successful debit, TransferSim:
1. Marks transfer as `failed`
2. Initiates automatic reversal to sender
3. Notifies both parties

## API Endpoints

### TransferSim

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transfers` | POST | Initiate a transfer |
| `/api/transfers/:id` | GET | Get transfer status |
| `/api/transfers/:id/cancel` | POST | Cancel pending transfer |

### BSIM (P2P Integration)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/p2p/debit` | POST | Debit user account |
| `/api/p2p/credit` | POST | Credit user account |
| `/api/users/resolve` | GET | Resolve alias to user |

## Security

- All inter-service communication uses API keys
- Idempotency keys prevent duplicate transfers
- Transfer amounts validated against account limits
- Webhooks signed with HMAC for verification

## Related Documentation

- [BLE Proximity Discovery](FLOW_BLE_DISCOVERY.md) - Contactless recipient discovery
- [Micro Merchant Payments](FLOW_MICRO_MERCHANT.md) - Business payment acceptance
- [WSIM Integration](../wsim/README.md) - Wallet backend setup
