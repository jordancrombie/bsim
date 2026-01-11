# BSIM API Specifications

This directory contains the API specification files for the Bank Simulator (BSIM) platform.

## Files

| File | Standard | Purpose |
|------|----------|---------|
| [openapi.yaml](../openapi.yaml) | OpenAPI 3.1 | REST API endpoints |
| [asyncapi.yaml](../asyncapi.yaml) | AsyncAPI 3.0 | Event-driven interfaces |

## OpenAPI vs AsyncAPI: When to Use Which

### OpenAPI (openapi.yaml)

**Use OpenAPI for**: Synchronous request/response APIs

OpenAPI (formerly Swagger) documents REST APIs where a client makes a request and waits for an immediate response. This covers the majority of BSIM's interfaces:

- **User Authentication**: Login, registration, passkey operations
- **Account Management**: Create accounts, check balances, view transactions
- **Transaction Operations**: Deposits, withdrawals, transfers
- **Credit Cards**: Card management and transaction history
- **Service-to-Service APIs**: P2P transfers, wallet integration, payment network

**Example use case**: A mobile app calls `POST /api/auth/login` and receives a JWT token in the response.

### AsyncAPI (asyncapi.yaml)

**Use AsyncAPI for**: Asynchronous event-driven interfaces

AsyncAPI documents message-based communication patterns including webhooks, pub/sub, and event streams. In BSIM, this covers:

- **Webhook Receivers**: Endpoints that receive callbacks from external services
- **Event Payloads**: Structure of events exchanged between services
- **Notification Events**: Internal events that trigger user notifications

**Example use case**: TransferSim sends a webhook to `POST /api/p2p/transfer/credit` to notify BSIM of an incoming transfer.

## Key Differences

| Aspect | OpenAPI | AsyncAPI |
|--------|---------|----------|
| Communication | Synchronous | Asynchronous |
| Pattern | Request → Response | Publish/Subscribe, Webhooks |
| Initiator | Client makes request | Either party can initiate |
| Waiting | Client waits for response | Fire-and-forget or callback |
| Use in BSIM | User-facing APIs, S2S calls | Webhooks, notifications |

## BSIM Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BSIM Platform                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  REST APIs (OpenAPI)                Event Interfaces (AsyncAPI) │
│  ├─ /api/auth/*                     ├─ P2P webhooks from        │
│  ├─ /api/accounts/*                 │   TransferSim             │
│  ├─ /api/transactions/*             ├─ Payment callbacks        │
│  ├─ /api/credit-cards/*             │   from NSIM               │
│  ├─ /api/p2p/* (S2S)                └─ Internal notification    │
│  ├─ /api/wallet/* (S2S)                 events                  │
│  ├─ /api/payment-network/* (S2S)                                │
│  └─ /api/wsim/* (enrollment)                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
    ┌──────────┐  ┌──────────┐           ┌──────────────┐
    │ Frontend │  │  Admin   │           │ TransferSim  │
    │  (Web)   │  │  Portal  │           │    (P2P)     │
    └──────────┘  └──────────┘           └──────────────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │    WSIM      │
                                         │  (Wallet)    │
                                         └──────────────┘
```

## Authentication Methods

BSIM uses different authentication depending on the API:

| API | Auth Method | Header/Token |
|-----|-------------|--------------|
| User APIs | Bearer JWT | `Authorization: Bearer <token>` |
| P2P API | API Key | `X-API-Key: <key>` |
| Payment Network | API Key | `X-API-Key: <key>` |
| Wallet API | Credential Token | `Authorization: Bearer <token>` |
| OpenBanking | OAuth 2.0 | Access token with FDX scopes |

## Viewing the Specs

### Online Viewers

- **OpenAPI**: [Swagger Editor](https://editor.swagger.io/) - paste the YAML content
- **AsyncAPI**: [AsyncAPI Studio](https://studio.asyncapi.com/) - paste the YAML content

### Local Tools

```bash
# Install Swagger UI for OpenAPI
npx @redocly/cli preview-docs docs/openapi.yaml

# Install AsyncAPI CLI
npm install -g @asyncapi/cli
asyncapi validate docs/asyncapi.yaml
asyncapi generate fromTemplate docs/asyncapi.yaml @asyncapi/html-template -o docs/asyncapi-html
```

## Versioning

Both specifications include version numbers in their `info.version` field. When making breaking changes:

1. Increment the major version
2. Document the changes in CHANGELOG.md
3. Update any dependent services

## Contributing

When modifying BSIM APIs:

1. **Update the spec first** - Document the change before implementing
2. **Keep schemas in sync** - Ensure request/response schemas match the code
3. **Add examples** - Include realistic example values
4. **Test with tools** - Validate YAML syntax and spec compliance

See the main [CLAUDE.md](../../.claude/CLAUDE.md) for the spec maintenance policy.
