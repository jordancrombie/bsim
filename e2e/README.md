# BSIM E2E Tests

End-to-end tests for the BSIM Banking Simulator using [Playwright](https://playwright.dev/).

## Quick Start

```bash
# Install dependencies and browsers (one-time setup)
make e2e-install

# Run all tests against local dev environment
make e2e

# Run tests with browser visible
make e2e-headed

# Run tests in Playwright UI mode (interactive)
make e2e-ui

# View the last test report
make e2e-report
```

## Test Structure

```
e2e/
├── playwright.config.ts      # Playwright configuration
├── tests/
│   ├── auth/
│   │   ├── signup.spec.ts    # Signup flow tests
│   │   ├── login.spec.ts     # Login flow tests
│   │   └── dashboard.spec.ts # Dashboard verification tests
│   ├── banking/
│   │   ├── accounts.spec.ts  # Account management tests
│   │   ├── credit-cards.spec.ts # Credit card tests
│   │   └── transfer.spec.ts  # Inter-customer transfer tests
│   ├── openbanking/
│   │   └── oidc-flow.spec.ts # OIDC/OAuth flow tests (requires SSIM)
│   └── fixtures/
│       └── test-data.ts      # Test user data and helpers
└── helpers/
    └── auth.helpers.ts       # Authentication helper functions
```

## Test Coverage

| Category | Tests | Description |
|----------|-------|-------------|
| Auth | 17 | Login, signup, dashboard, session management |
| Banking | 28 | Account CRUD, deposits, withdrawals, credit cards |
| Transfer | 8 | Inter-customer transfers via email |
| Open Banking | 9 | OIDC flow, consent, KENOK account fetch (requires SSIM) |
| **Total** | **76** | |

### Open Banking / OIDC Tests

The Open Banking tests validate BSIM's auth server and Open Banking APIs through the complete OAuth 2.0/OIDC flow:
- SSIM homepage and login page verification
- Redirect to BSIM auth server
- User authentication and consent flow
- Account selection during authorization
- Profile data display after authorization
- KENOK Open Banking account fetch via API
- Authorization denial handling
- Invalid credentials handling
- RP-initiated logout through auth server

**Important:** These tests require [SSIM](https://github.com/jordancrombie/ssim) (or another OIDC client) to be running. They validate BSIM's OAuth/OIDC implementation from the perspective of a third-party application.

### Test Design

Tests are atomic and self-contained. Each test suite creates its own users via `beforeAll` hooks rather than depending on users from other test suites. This ensures tests can run in any order, in parallel, or in isolation.

## Running Tests

### Local Development (default)

Tests run against `https://dev.banksim.ca` by default:

```bash
# All tests
npm test

# Specific browser
npm run test:chromium
npm run test:webkit

# Headed mode (see the browser)
npm run test:headed

# Debug mode (step through tests)
npm run test:debug

# UI mode (interactive test runner)
npm run test:ui
```

### Production Smoke Tests

Run tests against production (`https://banksim.ca`):

```bash
npm run test:prod
# or
make e2e-prod
```

## Test Data

Tests use dynamically generated email addresses in the format:
```
test-{timestamp}-{random}@testuser.banksim.ca
```

This ensures:
- No conflicts between test runs
- Easy identification of test data
- If email sending is added later, test emails stay internal

## Configuration

Environment variables:
- `BASE_URL` - Override the target URL (default: `https://dev.banksim.ca`)
- `CI` - Set by CI systems, enables retries and disables parallel execution

## Browsers

Tests run on:
- Chromium (Chrome)
- WebKit (Safari)

## Writing New Tests

1. Create test file in appropriate directory under `tests/`
2. Use fixtures from `tests/fixtures/test-data.ts`
3. Use helpers from `helpers/auth.helpers.ts` for auth operations
4. Follow existing patterns for consistency

Example:
```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import { signupUser } from '../../helpers/auth.helpers';

test('my new test', async ({ page }) => {
  const user = createTestUser();
  await signupUser(page, user);
  // ... test assertions
});
```

## Troubleshooting

### Tests fail with certificate errors
The config has `ignoreHTTPSErrors: true` for self-signed certs in dev. If you still have issues, ensure your local dev environment is running.

### Tests timeout waiting for elements
Check that the local dev environment (`make dev-up`) is running and accessible at `https://dev.banksim.ca`.

### Flaky tests
- Use `await expect(locator).toBeVisible()` instead of `await locator.click()` when checking presence
- Add appropriate timeouts for slow operations
- Check if elements have dynamic content that affects selectors
