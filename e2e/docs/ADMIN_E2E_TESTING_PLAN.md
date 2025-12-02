# Admin & Auth Server E2E Testing Plan

## Overview

This document outlines the implementation plan for enabling E2E testing of the Admin portal and Auth Server passkey authentication flows without requiring Super Admin credentials in test environments.

## Problem Statement

1. Admin/auth-server passkey testing requires an invite code
2. Invite codes can only be created by authenticated Super Admins
3. We cannot give E2E tests Super Admin credentials (especially in production)
4. We still need to test the full passkey registration and login flow

## Solution: Test-Only Invite Endpoint

Following the same pattern as the test cleanup endpoint (`/api/test-cleanup`), we'll create a protected endpoint that generates test invites for E2E testing.

### Endpoint Design

```
POST /api/test/admin-invites
Header: X-Test-Admin-Key: <secret>
Body: {
  "email": "test-admin-{timestamp}@testadmin.banksim.ca",
  "role": "ADMIN"  // optional, defaults to ADMIN
}
Response: {
  "code": "XXXX-XXXX-XXXX",
  "email": "...",
  "role": "ADMIN",
  "expiresAt": "..."
}
```

```
DELETE /api/test/admin-invites
Header: X-Test-Admin-Key: <secret>
Response: {
  "message": "Deleted X test admin invites",
  "deletedCount": X
}
```

```
DELETE /api/test/admins
Header: X-Test-Admin-Key: <secret>
Response: {
  "message": "Deleted X test admins",
  "deletedCount": X
}
```

### Security Measures

1. **Environment Variable Protection**: Endpoint only enabled when `TEST_ADMIN_KEY` env var is set
2. **Separate Secret**: Uses different secret from `TEST_CLEANUP_KEY` for defense in depth
3. **Test Domain Restriction**: Only creates invites for `@testadmin.banksim.ca` emails
4. **Short Expiration**: Test invites expire in 5 minutes
5. **Audit Trail**: All test invites are logged with `[Test Admin]` prefix
6. **No Super Admin Creation**: Test invites can only create `ADMIN` role, never `SUPER_ADMIN`

### Test Domain

- **Test admin email domain**: `@testadmin.banksim.ca`
- **Example email**: `test-admin-1764632688638@testadmin.banksim.ca`

This is separate from the regular user test domain (`@testuser.banksim.ca`) to clearly differentiate between test users and test admins.

## Implementation Steps

### Phase 1: Admin Server Test Endpoint

1. Create `/admin/app/api/test/admin-invites/route.ts`
   - POST: Create test invite (restricted to @testadmin.banksim.ca)
   - DELETE: Clean up test invites

2. Create `/admin/app/api/test/admins/route.ts`
   - DELETE: Clean up test admins (restricted to @testadmin.banksim.ca)

3. Update `docker-compose.yml`
   - Add `TEST_ADMIN_KEY` environment variable to admin service

### Phase 2: E2E Test Helpers

1. Create `e2e/helpers/admin.helpers.ts`
   - `createTestAdminInvite()`: Get invite code via API
   - `cleanupTestAdmins()`: Delete test admins and invites

2. Update `e2e/global-teardown.ts`
   - Add cleanup of test admins after test runs

### Phase 3: Admin E2E Tests

1. Create `e2e/tests/admin/passkey.spec.ts`
   - Test invite signup flow
   - Test passkey registration
   - Test passkey login
   - Test admin dashboard access

2. Create `e2e/tests/admin/basic.spec.ts`
   - Test admin login/logout
   - Test navigation
   - Test user listing

### Phase 4: Auth Server E2E Tests

1. Create `e2e/tests/auth-server/oauth-client.spec.ts`
   - Test OAuth client creation (requires admin auth)
   - Test OAuth client management

## File Changes Summary

### New Files
- `admin/app/api/test/admin-invites/route.ts` - Test invite endpoint
- `admin/app/api/test/admins/route.ts` - Test admin cleanup endpoint
- `e2e/helpers/admin.helpers.ts` - Admin E2E helper functions
- `e2e/tests/admin/passkey.spec.ts` - Admin passkey tests
- `e2e/tests/admin/basic.spec.ts` - Admin basic flow tests
- `e2e/tests/auth-server/oauth-client.spec.ts` - Auth server tests

### Modified Files
- `docker-compose.yml` - Add TEST_ADMIN_KEY
- `e2e/global-teardown.ts` - Add admin cleanup

## Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `TEST_ADMIN_KEY` | admin | Secret key to access test admin endpoints |
| `TEST_CLEANUP_KEY` | backend | Secret key to access test cleanup endpoints (existing) |

**Default values for development:**
- `TEST_ADMIN_KEY`: `bsim-test-admin-secret-key`
- `TEST_CLEANUP_KEY`: `bsim-test-cleanup-secret-key`

## Testing Flow

### E2E Test Sequence

```
1. E2E Test Setup:
   ├── Call POST /api/test/admin-invites
   │   └── Get invite code for test-admin-{timestamp}@testadmin.banksim.ca
   │
2. Admin Passkey Test:
   ├── Navigate to /invite?code=XXXX-XXXX-XXXX
   ├── Fill in admin details
   ├── Register passkey (using Chrome CDP virtual authenticator)
   ├── Verify dashboard access
   │
3. Admin Login Test:
   ├── Navigate to /login
   ├── Login with passkey
   ├── Verify session
   │
4. E2E Test Teardown:
   ├── Call DELETE /api/test/admins
   │   └── Delete test-admin-*@testadmin.banksim.ca
   └── Call DELETE /api/test/admin-invites
       └── Delete unused test invites
```

## Production Safety

1. **Do NOT set TEST_ADMIN_KEY in production** - endpoint returns 503
2. If accidentally set, only @testadmin.banksim.ca emails can be created
3. Test admins can only have ADMIN role, never SUPER_ADMIN
4. Cleanup scripts in `aws-admin.sh` can remove test admins if needed:
   ```bash
   ./scripts/aws-admin.sh cleanup-test-admins
   ```
