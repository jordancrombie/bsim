import { test, expect } from '@playwright/test';
import {
  createTestAdmin,
  createTestAdminInvite,
  getAdminUrl,
  ADMIN_PAGES,
} from '../../helpers/admin.helpers';
import {
  setupVirtualAuthenticator,
  simulatePasskeySuccess,
  getStoredCredentials,
  teardownVirtualAuthenticator,
  WebAuthnContext,
} from '../../helpers/webauthn.helpers';

/**
 * Admin Passkey Authentication E2E Tests
 *
 * These tests validate the complete admin passkey (WebAuthn) authentication flow:
 * - Admin invite code signup with passkey registration
 * - Admin passkey login
 * - Admin dashboard access after authentication
 *
 * IMPORTANT: These tests only run on Chromium because they use Chrome DevTools
 * Protocol (CDP) to create a virtual WebAuthn authenticator.
 *
 * Tests use the test-only admin invite endpoint to get invite codes without
 * requiring Super Admin credentials.
 */

// Configure serial execution - tests in this file depend on shared state
test.describe.configure({ mode: 'serial' });

test.describe('Admin Passkey Authentication', () => {
  // Skip on non-Chromium browsers - CDP required for virtual authenticator
  test.skip(({ browserName }) => browserName !== 'chromium',
    'WebAuthn virtual authenticator requires Chromium');

  let webauthn: WebAuthnContext;
  let adminUrl: string;

  test.beforeAll(() => {
    adminUrl = getAdminUrl();
  });

  test.beforeEach(async ({ page }) => {
    // Set up virtual authenticator for each test
    webauthn = await setupVirtualAuthenticator(page);
  });

  test.afterEach(async () => {
    // Clean up virtual authenticator
    if (webauthn) {
      await teardownVirtualAuthenticator(webauthn);
    }
  });

  test('should register passkey during admin invite signup', async ({ page }) => {
    const testAdmin = createTestAdmin({ firstName: 'E2E', lastName: 'Admin' });

    // Get invite code via test API
    const invite = await createTestAdminInvite(testAdmin.email);
    expect(invite.code).toBeTruthy();
    expect(invite.email).toBe(testAdmin.email);

    // Verify no credentials initially
    const initialCredentials = await getStoredCredentials(webauthn);
    expect(initialCredentials).toHaveLength(0);

    // Navigate to invite page with code
    await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);

    // Wait for the invite form to load
    await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

    // The email should be pre-filled from the invite (displayed in disabled field)
    await expect(page.getByRole('textbox', { name: /email/i })).toHaveValue(testAdmin.email);

    // Fill in admin details
    await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
    await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

    // Submit the form - this triggers passkey registration
    await simulatePasskeySuccess(webauthn, async () => {
      await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
    });

    // Verify credential was stored in virtual authenticator
    const credentials = await getStoredCredentials(webauthn);
    expect(credentials).toHaveLength(1);
    expect(credentials[0].isResidentCredential).toBe(true);

    // Should be redirected to admin dashboard
    await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

    // Verify we're logged in by checking for admin dashboard content
    await expect(page.getByRole('heading', { name: /Dashboard|Welcome|Admin/i })).toBeVisible({ timeout: 10000 });
  });

  test('should login with passkey after registration', async ({ page }) => {
    // This test is self-contained - creates admin, registers passkey, logs out, logs back in
    const testAdmin = createTestAdmin({ firstName: 'Login', lastName: 'Test' });

    // Create invite and register
    const invite = await createTestAdminInvite(testAdmin.email);
    await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);

    await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
    await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

    await simulatePasskeySuccess(webauthn, async () => {
      await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
    });

    // Wait for dashboard
    await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

    // Get initial sign count
    const credentialsBeforeLogout = await getStoredCredentials(webauthn);
    expect(credentialsBeforeLogout.length).toBeGreaterThan(0);
    const initialSignCount = credentialsBeforeLogout[0].signCount;

    // Logout
    await page.getByRole('button', { name: /Logout|Sign Out/i }).click();

    // Wait for redirect to login page
    await expect(page).toHaveURL(new RegExp(`${ADMIN_PAGES.login}`), { timeout: 10000 });

    // Navigate to login page
    await page.goto(`${adminUrl}${ADMIN_PAGES.login}`);

    // Wait for login page to load (heading is "BSIM Admin")
    await expect(page.getByRole('heading', { name: /BSIM Admin/i })).toBeVisible({ timeout: 10000 });

    // Click passkey login button
    await simulatePasskeySuccess(webauthn, async () => {
      await page.getByRole('button', { name: /Passkey|Sign in with Passkey/i }).click();
    });

    // Should be redirected to admin dashboard
    await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

    // Verify sign count increased (proves authentication happened)
    const credentialsAfterLogin = await getStoredCredentials(webauthn);
    expect(credentialsAfterLogin[0].signCount).toBeGreaterThan(initialSignCount);
  });

  test('should show passkey login button on admin login page', async ({ page }) => {
    // Navigate to admin login page
    await page.goto(`${adminUrl}${ADMIN_PAGES.login}`);

    // With virtual authenticator enabled, passkey button should be visible
    await expect(page.getByRole('button', { name: /Passkey|Sign in with Passkey/i })).toBeVisible({ timeout: 10000 });
  });

  test('should reject invalid invite code', async ({ page }) => {
    // Navigate to invite page with invalid code
    await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=INVALID-CODE-XXXX`);

    // Should show error message
    await expect(page.getByText(/invalid|expired|not found/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle invite signup with missing fields', async ({ page }) => {
    const testAdmin = createTestAdmin();

    // Get invite code via test API
    const invite = await createTestAdminInvite(testAdmin.email);

    // Navigate to invite page with code
    await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);

    // Wait for the form to load
    await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /Create Account with Passkey/i }).click();

    // Should show validation errors or remain on the form
    // The form should prevent submission with empty required fields
    const currentUrl = page.url();
    expect(currentUrl).toContain('invite');
  });
});

test.describe('Admin Dashboard Access', () => {
  test.skip(({ browserName }) => browserName !== 'chromium',
    'WebAuthn virtual authenticator requires Chromium');

  test('should access admin dashboard after login', async ({ page }) => {
    const adminUrl = getAdminUrl();
    const webauthn = await setupVirtualAuthenticator(page);

    try {
      // Create and register an admin
      const testAdmin = createTestAdmin({ firstName: 'Dashboard', lastName: 'Access' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);

      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });
      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      // Wait for dashboard
      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Verify dashboard content is visible (admin is logged in)
      await expect(page.getByRole('heading', { name: /Dashboard|Welcome|Admin/i })).toBeVisible({ timeout: 10000 });

    } finally {
      await teardownVirtualAuthenticator(webauthn);
    }
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    const adminUrl = getAdminUrl();

    // Try to access dashboard without being logged in
    await page.goto(`${adminUrl}${ADMIN_PAGES.dashboard}`);

    // Should redirect to login
    await expect(page).toHaveURL(new RegExp(`${ADMIN_PAGES.login}`), { timeout: 10000 });
  });
});
