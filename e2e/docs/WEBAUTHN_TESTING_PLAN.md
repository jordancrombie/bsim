# WebAuthn/Passkey E2E Testing Plan

This document outlines the plan for implementing E2E tests for passkey (WebAuthn) authentication in BSIM.

## Background

BSIM uses WebAuthn/passkeys for passwordless authentication across three interfaces:
- **Frontend** (banksim.ca) - User passkey registration and login
- **Admin** (admin.banksim.ca) - Admin passkey authentication
- **Auth Server** (auth.banksim.ca) - OIDC consent with passkey auth

### Current State
- **Unit tests**: 20+ tests in backend, 13+ tests in admin (excellent coverage)
- **E2E tests**: Zero passkey-specific tests
- **Libraries**: @simplewebauthn/browser (frontend), @simplewebauthn/server (backend)

## Technical Approach

### Playwright WebAuthn Virtual Authenticator

Playwright supports WebAuthn testing via Chrome DevTools Protocol (CDP). This creates a virtual authenticator that simulates biometric authentication without real hardware.

**Key limitation**: Only works with Chromium browser (not WebKit/Firefox).

### CDP Commands Used

| Command | Purpose |
|---------|---------|
| `WebAuthn.enable` | Enable WebAuthn environment |
| `WebAuthn.addVirtualAuthenticator` | Create virtual authenticator |
| `WebAuthn.setUserVerified` | Simulate biometric success/failure |
| `WebAuthn.setAutomaticPresenceSimulation` | Auto-respond to WebAuthn prompts |
| `WebAuthn.getCredentials` | List stored credentials |
| `WebAuthn.removeCredential` | Delete a credential |

### Virtual Authenticator Configuration

```typescript
{
  protocol: 'ctap2',           // CTAP2 protocol (modern passkeys)
  transport: 'internal',       // Platform authenticator (Touch ID, Face ID, etc.)
  hasResidentKey: true,        // Discoverable credentials (required for passwordless)
  hasUserVerification: true,   // Support biometric verification
  isUserVerified: true,        // Simulate successful verification
  automaticPresenceSimulation: false,  // Manual control for explicit testing
}
```

## Implementation Plan

### Phase 1: Helper Functions & Basic Registration

1. Create `e2e/helpers/webauthn.helpers.ts` with:
   - `setupVirtualAuthenticator()` - Initialize CDP session and virtual authenticator
   - `simulatePasskeySuccess()` - Trigger and wait for successful passkey operation
   - `simulatePasskeyFailure()` - Simulate user cancellation or verification failure
   - `getStoredCredentials()` - Get credentials from virtual authenticator
   - `clearCredentials()` - Remove all credentials (simulate new device)

2. Create `e2e/tests/auth/passkey.spec.ts` with basic registration test

### Phase 2: Full Passkey Test Suite

#### Registration Tests (`passkey.spec.ts`)
| Test | Description |
|------|-------------|
| Register passkey after signup | Complete signup → Accept passkey prompt → Verify credential stored |
| Skip passkey prompt | Complete signup → Skip → Can still access dashboard |
| Passkey appears in virtual authenticator | After registration, verify credential exists |

#### Login Tests (`passkey.spec.ts`)
| Test | Description |
|------|-------------|
| Login with passkey | Register → Logout → Login with passkey → Dashboard |
| Passkey login updates counter | Verify signCount increases after each auth |

#### Management Tests (future)
| Test | Description |
|------|-------------|
| Delete passkey | Remove passkey → Can't login with it |
| Multiple passkeys | Register 2+ passkeys, login with either |

### Phase 3: Admin Passkey Tests

Apply same pattern to admin interface at `admin.banksim.ca`:
- Admin passkey registration
- Admin passkey login
- First-user setup flow

### Phase 4: Auth Server Passkey Tests

Apply same pattern to auth server at `auth.banksim.ca`:
- Passkey authentication during OIDC consent

## File Structure

```
e2e/
├── helpers/
│   ├── auth.helpers.ts          # Existing auth helpers
│   └── webauthn.helpers.ts      # NEW: Virtual authenticator helpers
├── tests/
│   └── auth/
│       ├── signup.spec.ts       # Existing
│       ├── login.spec.ts        # Existing
│       ├── dashboard.spec.ts    # Existing
│       └── passkey.spec.ts      # NEW: Passkey tests
└── docs/
    └── WEBAUTHN_TESTING_PLAN.md # This document
```

## Helper Functions API

```typescript
// helpers/webauthn.helpers.ts

export interface WebAuthnContext {
  client: CDPSession;
  authenticatorId: string;
}

// Initialize virtual authenticator (Chromium only)
export async function setupVirtualAuthenticator(page: Page): Promise<WebAuthnContext>;

// Simulate successful passkey operation (registration or login)
export async function simulatePasskeySuccess(
  context: WebAuthnContext,
  triggerAction: () => Promise<void>
): Promise<void>;

// Simulate failed passkey operation (user cancelled or verification failed)
export async function simulatePasskeyFailure(
  context: WebAuthnContext,
  triggerAction: () => Promise<void>,
  verifyError: () => Promise<void>
): Promise<void>;

// Get credentials stored in virtual authenticator
export async function getStoredCredentials(
  context: WebAuthnContext
): Promise<Credential[]>;

// Clear all credentials (simulate new device)
export async function clearCredentials(context: WebAuthnContext): Promise<void>;

// Cleanup - remove virtual authenticator
export async function teardownVirtualAuthenticator(context: WebAuthnContext): Promise<void>;
```

## Test Example

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import {
  setupVirtualAuthenticator,
  simulatePasskeySuccess,
  getStoredCredentials,
  teardownVirtualAuthenticator
} from '../../helpers/webauthn.helpers';

test.describe('Passkey Authentication', () => {
  // Skip on non-Chromium browsers
  test.skip(({ browserName }) => browserName !== 'chromium',
    'WebAuthn virtual authenticator requires Chromium');

  test('should register passkey after signup and login with it', async ({ page }) => {
    const testUser = createTestUser({ firstName: 'Passkey', lastName: 'User' });
    const webauthn = await setupVirtualAuthenticator(page);

    try {
      // Verify no credentials initially
      expect(await getStoredCredentials(webauthn)).toHaveLength(0);

      // Complete signup flow...
      // ...

      // Register passkey
      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /set up passkey/i }).click();
      });

      // Verify credential stored
      expect(await getStoredCredentials(webauthn)).toHaveLength(1);

      // Logout and login with passkey
      // ...

    } finally {
      await teardownVirtualAuthenticator(webauthn);
    }
  });
});
```

## Considerations

### Browser Support
- **Chromium**: Full support via CDP
- **WebKit**: No virtual authenticator support - tests will be skipped
- **Firefox**: Limited CDP support - tests will be skipped

### Test Isolation
- Each test gets a fresh virtual authenticator
- Credentials are isolated per authenticator instance
- Use `teardownVirtualAuthenticator()` in finally block

### Challenge Storage
- BSIM uses in-memory Map for WebAuthn challenges
- Works for single-instance testing
- For distributed testing, would need Redis/database storage

### Resident Keys
- Must use `hasResidentKey: true` for discoverable credentials
- Required for passwordless login without email hint

## References

- [Passkeys E2E Playwright Testing via WebAuthn Virtual Authenticator](https://www.corbado.com/blog/passkeys-e2e-playwright-testing-webauthn-virtual-authenticator)
- [Testing WebAuthn with Playwright - SimpleWebAuthn Discussion](https://github.com/MasterKale/SimpleWebAuthn/discussions/678)
- [Chrome DevTools Protocol - WebAuthn Domain](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
