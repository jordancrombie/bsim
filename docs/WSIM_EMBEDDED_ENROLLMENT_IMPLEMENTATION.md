# WSIM Embedded Enrollment - BSIM Implementation

## Overview

This document outlines the implementation for adding embedded WSIM enrollment to BSIM. This feature allows bank users to enroll in WSIM Wallet directly from the BSIM dashboard without leaving the bank's website.

**Branch:** `feature/embedded-wsim-enrollment`

**Status:** ✅ Complete - Embedded enrollment and server-side SSO working

**Reference Documentation:** `/Users/jcrombie/ai/wsim/docs/BSIM_ENROLLMENT_INTEGRATION.md`

---

## Implementation Status

### Completed

- [x] Backend: Environment variables for WSIM integration
- [x] Backend: WSIM enrollment routes (`/api/wsim/enrollment-data`, `/api/wsim/enrollment-status`, `/api/wsim/config`, `/api/wsim/enrollment-complete`)
- [x] Backend: Server-side SSO endpoint (`/api/wsim/sso-url`) for true cross-device SSO
- [x] Backend: Wallet routes with cardToken JWT authentication (`/api/wallet/cards/enroll`)
- [x] Frontend: Wallet Pay page (`/dashboard/wallet-pay`)
- [x] Frontend: WSIM enrollment utilities with postMessage handling
- [x] Frontend: API client methods for enrollment and SSO
- [x] Frontend: "Open WSIM Wallet" button uses server-side SSO
- [x] Docker: Environment variables for dev and production
- [x] WSIM: Partner SSO API (`POST /api/partner/sso-token`)

### Issues Resolved During Integration

1. **postMessage not working** - WSIM was using `window.parent` (for iframes) but BSIM opens a popup. Fixed by WSIM team to use `window.opener`.

2. **Card fetch failing with ECONNREFUSED** - WSIM was using `http://localhost:3001` inside Docker. Fixed by adding `BSIM_API_URL` environment variable.

3. **"Invalid wallet credential" error** - WSIM was calling wrong endpoint. BSIM provides `/api/wallet/cards/enroll` for enrollment flow (cardToken JWT auth), not `/api/wallet/cards` (WalletCredential database token auth).

---

## Configuration (Confirmed with WSIM Team)

### Environment Variables

Add to `backend/.env`:

```bash
# Bank identifier
BSIM_ID=bsim

# Shared secret for signing enrollment payloads (must match WSIM's INTERNAL_API_SECRET)
# Dev: use 'dev-internal-secret-change-in-production'
# Prod: coordinate secure exchange with WSIM team
WSIM_SHARED_SECRET=dev-internal-secret-change-in-production

# Secret for signing card access tokens (BSIM-internal, generate your own)
CARD_TOKEN_SECRET=bsim-card-token-secret-change-in-production

# WSIM Auth Server URL
# Dev: https://wsim-auth-dev.banksim.ca
# Prod: https://wsim-auth.banksim.ca
WSIM_AUTH_URL=https://wsim-auth-dev.banksim.ca
```

### Environment-Specific URLs

| Environment | BSIM Origin | WSIM Auth URL |
|-------------|-------------|---------------|
| Local dev | `http://localhost:3000` | `http://localhost:3005` |
| Dev/staging | `https://dev.banksim.ca` | `https://wsim-auth-dev.banksim.ca` |
| Production | `https://banksim.ca` | `https://wsim-auth.banksim.ca` |

### Origin Allowlist (Confirmed)

WSIM has added both BSIM origins to their allowlist:
- `https://dev.banksim.ca` - Dev/staging
- `https://banksim.ca` - Production

---

## Existing BSIM Infrastructure

### Already Implemented

1. **`/api/wallet/cards` endpoint** - [backend/src/routes/walletRoutes.ts:86-131](backend/src/routes/walletRoutes.ts#L86)
   - Returns cards in WSIM's expected format: `id`, `cardType`, `cardHolder`, `lastFour`, `expiryMonth`, `expiryYear`
   - Currently uses `WalletCredential` token authentication
   - **Needs:** Additional authentication method for `cardToken` JWT

2. **Credit Card System**
   - Full `CreditCard` model with all required fields
   - Routes at `/api/credit-cards`
   - UI at `/dashboard/credit-cards`

3. **PasskeyPrompt Component** - [frontend/components/PasskeyPrompt.tsx](frontend/components/PasskeyPrompt.tsx)
   - Good pattern to follow for `WsimEnrollmentPrompt`

4. **Dashboard Layout** - [frontend/app/dashboard/layout.tsx](frontend/app/dashboard/layout.tsx)
   - Sidebar navigation with Dashboard, Accounts, Credit Cards, Transfer

---

## Implementation Tasks

### Phase 1: Backend

#### 1.1 Add Environment Variables

Update `backend/src/config/env.ts` to include:
- `BSIM_ID`
- `WSIM_SHARED_SECRET`
- `CARD_TOKEN_SECRET`
- `WSIM_AUTH_URL`

#### 1.2 Create WSIM Enrollment Routes

Create `backend/src/routes/wsimEnrollmentRoutes.ts`:

```typescript
// POST /api/wsim/enrollment-data
// Generates signed enrollment payload with cardToken for WSIM embedded enrollment
```

This endpoint:
1. Requires user authentication (existing `authMiddleware`)
2. Generates a short-lived `cardToken` JWT (5 minutes)
3. Creates HMAC signature of the payload
4. Returns: `{ claims, cardToken, bsimId, signature, timestamp }`

#### 1.3 Update Wallet Routes for cardToken Authentication

Modify `backend/src/routes/walletRoutes.ts`:
- Add alternative authentication path for `cardToken` JWT
- Verify token was signed with `CARD_TOKEN_SECRET`
- Extract `userId` from token and return their cards

### Phase 2: Frontend

#### 2.1 Add Wallet Pay to Navigation

Update `frontend/app/dashboard/layout.tsx`:
- Add "Wallet Pay" link to sidebar (after Transfer)
- Use wallet icon

#### 2.2 Create Wallet Pay Page

Create `frontend/app/dashboard/wallet-pay/page.tsx`:
- Show enrollment status
- "Enable Wallet Pay" button if not enrolled
- Manage enrolled cards if already enrolled

#### 2.3 Create WsimEnrollmentPrompt Component

Create `frontend/components/WsimEnrollmentPrompt.tsx`:
- Similar to `PasskeyPrompt` pattern
- Dismissable with "remind me later" / "don't ask again" options
- Displays on dashboard for users with credit cards who haven't enrolled

#### 2.4 Implement WSIM Popup Communication

Create `frontend/lib/wsimEnrollment.ts`:
- `openWsimEnrollment()` function
- PostMessage listener for WSIM events:
  - `wsim:enroll-ready` - Send enrollment data
  - `wsim:enrolled` - Handle success
  - `wsim:already-enrolled` - Handle already enrolled
  - `wsim:enroll-cancelled` - Handle cancellation
  - `wsim:enroll-error` - Handle errors

#### 2.5 Add API Client Method

Update `frontend/lib/api.ts`:
- Add `getWsimEnrollmentData()` method

### Phase 3: Docker/Environment

#### 3.1 Update docker-compose.dev.yml

Add environment variables:
```yaml
backend:
  environment:
    BSIM_ID: bsim
    WSIM_SHARED_SECRET: dev-internal-secret-change-in-production
    CARD_TOKEN_SECRET: bsim-card-token-secret-dev
    WSIM_AUTH_URL: https://wsim-auth-dev.banksim.ca
```

#### 3.2 Update Frontend Build Args

Add to frontend service:
```yaml
frontend:
  build:
    args:
      NEXT_PUBLIC_WSIM_AUTH_URL: https://wsim-auth-dev.banksim.ca
```

---

## PostMessage Protocol

### BSIM Sends to WSIM

#### wsim:enroll-init
```typescript
{
  type: 'wsim:enroll-init',
  claims: {
    sub: string,          // BSIM user ID
    email: string,
    given_name?: string,
    family_name?: string,
  },
  cardToken: string,      // JWT for server-to-server card fetch
  bsimId: string,         // 'bsim'
  signature: string,      // HMAC-SHA256 signature
  timestamp: number,      // Milliseconds since epoch
}
```

### WSIM Sends to BSIM

| Message Type | Description |
|--------------|-------------|
| `wsim:enroll-ready` | WSIM popup ready to receive data |
| `wsim:enrolled` | Success - includes `walletId`, `sessionToken`, `cardsEnrolled` |
| `wsim:already-enrolled` | User already has WSIM wallet |
| `wsim:enroll-cancelled` | User cancelled enrollment |
| `wsim:enroll-error` | Error with `error` message and `code` |

---

## Security Notes

1. **Card data never passes through browser** - Only `cardToken` JWT passes through postMessage
2. **WSIM fetches cards server-to-server** - Calls BSIM's `/api/wallet/cards` with `cardToken`
3. **Signature verification** - HMAC-SHA256 with shared secret prevents tampering
4. **Timestamp validation** - Must be within 5 minutes to prevent replay attacks
5. **cardToken expiration** - 5 minutes, limits theft window

---

## Testing Plan

### Prerequisites
1. User logged into BSIM with at least one credit card
2. WSIM dev environment running (`https://wsim-auth-dev.banksim.ca`)
3. Browser: Chrome 128+ or Safari 18+ (for cross-origin passkeys)

### Test Flow
1. Log in to BSIM at `https://dev.banksim.ca`
2. Navigate to Wallet Pay page (or see prompt on dashboard)
3. Click "Enable Wallet Pay"
4. Verify popup opens at WSIM auth server
5. Verify cards are displayed (fetched server-to-server)
6. Select card(s) and register passkey
7. Verify success message in BSIM
8. Verify "Wallet Pay" shows enrolled status

### Error Cases to Test
- Popup blocked by browser
- User cancels enrollment
- Invalid signature (misconfigured secret)
- Card fetch fails
- Passkey registration fails (unsupported browser)

---

## Files to Create/Modify

### New Files
- `backend/src/routes/wsimEnrollmentRoutes.ts`
- `frontend/app/dashboard/wallet-pay/page.tsx`
- `frontend/components/WsimEnrollmentPrompt.tsx`
- `frontend/lib/wsimEnrollment.ts`

### Modified Files
- `backend/src/config/env.ts` - Add new env vars
- `backend/src/server.ts` - Register new routes
- `backend/src/routes/walletRoutes.ts` - Add cardToken auth
- `frontend/app/dashboard/layout.tsx` - Add nav link
- `frontend/app/dashboard/page.tsx` - Add enrollment prompt
- `frontend/lib/api.ts` - Add enrollment data method
- `docker-compose.dev.yml` - Add env vars
- `docker-compose.yml` - Add env vars (for production)

---

## Server-Side SSO

After enrollment, users can open their WSIM Wallet from BSIM with automatic login (no passkey required).

### How It Works

1. User clicks "Open WSIM Wallet" button in BSIM
2. BSIM frontend calls `GET /api/wsim/sso-url`
3. BSIM backend calls WSIM's `POST /api/partner/sso-token` with signed payload
4. WSIM returns a short-lived (5 minute) SSO URL
5. BSIM frontend opens the SSO URL in a new tab
6. User is automatically logged into WSIM

### Key Files

- **Backend**: `backend/src/routes/wsimEnrollmentRoutes.ts` - `GET /api/wsim/sso-url` endpoint
- **Frontend**: `frontend/lib/api.ts` - `getWsimSsoUrl()` method
- **Frontend**: `frontend/app/dashboard/wallet-pay/page.tsx` - `handleOpenWallet()` function

### Benefits

- **True SSO** - Works on any browser/device as long as user is logged into BSIM
- **No localStorage dependency** - Server-side token generation
- **Short-lived tokens** - 5-minute expiry minimizes security exposure

### Troubleshooting

If SSO returns 404 "user_not_found":
- The WSIM `BsimEnrollment.fiUserRef` must match BSIM's user ID
- Users enrolled via OIDC flow may have a different `fiUserRef` than their BSIM user ID
- Embedded enrollment automatically uses the correct BSIM user ID

---

## Production Deployment Notes

Before production deployment:
1. Generate secure `CARD_TOKEN_SECRET` (use `openssl rand -hex 32`)
2. Coordinate `WSIM_SHARED_SECRET` exchange with WSIM team via secure channel
3. Update `WSIM_AUTH_URL` to `https://wsim-auth.banksim.ca`
4. Verify BSIM backend is accessible from WSIM backend for card fetch
