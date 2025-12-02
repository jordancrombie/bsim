import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import {
  setupVirtualAuthenticator,
  simulatePasskeySuccess,
  getStoredCredentials,
  teardownVirtualAuthenticator,
  WebAuthnContext,
} from '../../helpers/webauthn.helpers';

/**
 * Passkey Authentication E2E Tests
 *
 * These tests validate the complete passkey (WebAuthn) authentication flow:
 * - Passkey registration after signup
 * - Passkey login
 * - Skipping passkey setup
 *
 * IMPORTANT: These tests only run on Chromium because they use Chrome DevTools
 * Protocol (CDP) to create a virtual WebAuthn authenticator.
 *
 * The virtual authenticator simulates a platform authenticator (Touch ID, Face ID,
 * Windows Hello) without requiring real biometric hardware.
 */

// Configure serial execution - tests in this file depend on shared state
test.describe.configure({ mode: 'serial' });

test.describe('Passkey Authentication', () => {
  // Skip on non-Chromium browsers - CDP required for virtual authenticator
  test.skip(({ browserName }) => browserName !== 'chromium',
    'WebAuthn virtual authenticator requires Chromium');

  let webauthn: WebAuthnContext;

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

  test('should register passkey after signup and access dashboard', async ({ page }) => {
    const testUser = createTestUser({ firstName: 'Passkey', lastName: 'Registration' });

    // Verify no credentials initially
    const initialCredentials = await getStoredCredentials(webauthn);
    expect(initialCredentials).toHaveLength(0);

    // Go to signup page
    await page.goto(PAGES.signup);

    // Step 1: Fill account information
    await page.fill('#firstName', testUser.firstName);
    await page.fill('#lastName', testUser.lastName);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);

    // Continue to step 2
    await page.click('button:has-text("Continue to Customer Information")');

    // Step 2: Fill customer information (minimal)
    await page.fill('#phone', testUser.phone || '');

    // Submit the form
    await page.click('button:has-text("Create Account")');

    // Wait for passkey prompt to appear
    await expect(page.getByRole('heading', { name: 'Account Created!' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Set Up Passkey' })).toBeVisible();

    // Register passkey using virtual authenticator
    await simulatePasskeySuccess(webauthn, async () => {
      await page.getByRole('button', { name: 'Set Up Passkey' }).click();
    });

    // Verify credential was stored in virtual authenticator
    const credentials = await getStoredCredentials(webauthn);
    expect(credentials).toHaveLength(1);
    expect(credentials[0].isResidentCredential).toBe(true);

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should skip passkey setup and still access dashboard', async ({ page }) => {
    const testUser = createTestUser({ firstName: 'Skip', lastName: 'Passkey' });

    // Go to signup page
    await page.goto(PAGES.signup);

    // Step 1: Fill account information
    await page.fill('#firstName', testUser.firstName);
    await page.fill('#lastName', testUser.lastName);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);

    // Continue to step 2
    await page.click('button:has-text("Continue to Customer Information")');

    // Submit the form (no customer info needed)
    await page.click('button:has-text("Create Account")');

    // Wait for passkey prompt
    await expect(page.getByRole('heading', { name: 'Account Created!' })).toBeVisible({ timeout: 10000 });

    // Skip passkey setup
    await page.getByRole('button', { name: 'Skip for now' }).click();

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // No credentials should be stored
    const credentials = await getStoredCredentials(webauthn);
    expect(credentials).toHaveLength(0);
  });

  test('should login with passkey after registration', async ({ page }) => {
    const testUser = createTestUser({ firstName: 'Passkey', lastName: 'Login' });

    // --- REGISTRATION PHASE ---

    // Go to signup page and create account
    await page.goto(PAGES.signup);

    // Step 1
    await page.fill('#firstName', testUser.firstName);
    await page.fill('#lastName', testUser.lastName);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);
    await page.click('button:has-text("Continue to Customer Information")');

    // Step 2 - just submit
    await page.click('button:has-text("Create Account")');

    // Wait for passkey prompt and register passkey
    await expect(page.getByRole('heading', { name: 'Account Created!' })).toBeVisible({ timeout: 10000 });

    await simulatePasskeySuccess(webauthn, async () => {
      await page.getByRole('button', { name: 'Set Up Passkey' }).click();
    });

    // Verify on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Get initial sign count
    const credentialsAfterReg = await getStoredCredentials(webauthn);
    expect(credentialsAfterReg).toHaveLength(1);
    const initialSignCount = credentialsAfterReg[0].signCount;

    // --- LOGOUT ---

    // Click logout button
    await page.getByRole('button', { name: 'Logout' }).click();

    // Logout redirects to home page, then navigate to login
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await page.goto(PAGES.login);

    // --- LOGIN WITH PASSKEY ---

    // Verify passkey button is visible (virtual authenticator makes platform auth available)
    await expect(page.getByRole('button', { name: 'Sign in with Passkey' })).toBeVisible();

    // Optionally enter email (helps with credential selection)
    await page.fill('#email', testUser.email);

    // Login with passkey
    await simulatePasskeySuccess(webauthn, async () => {
      await page.getByRole('button', { name: 'Sign in with Passkey' }).click();
    });

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Verify sign count increased (proves authentication happened)
    const credentialsAfterLogin = await getStoredCredentials(webauthn);
    expect(credentialsAfterLogin[0].signCount).toBeGreaterThan(initialSignCount);
  });

  test('should show passkey button on login page', async ({ page }) => {
    // With virtual authenticator enabled, passkey button should be visible
    await page.goto(PAGES.login);

    // Passkey button should be visible
    await expect(page.getByRole('button', { name: 'Sign in with Passkey' })).toBeVisible();

    // Divider should be visible
    await expect(page.getByText('Or continue with')).toBeVisible();
  });
});

test.describe('Passkey Login - No Passkey Registered', () => {
  test.skip(({ browserName }) => browserName !== 'chromium',
    'WebAuthn virtual authenticator requires Chromium');

  test('should handle passkey login attempt when no passkey is registered', async ({ page }) => {
    const webauthn = await setupVirtualAuthenticator(page);

    try {
      // Create a user without passkey
      const testUser = createTestUser({ firstName: 'No', lastName: 'Passkey' });

      // Go to signup page
      await page.goto(PAGES.signup);

      // Complete signup
      await page.fill('#firstName', testUser.firstName);
      await page.fill('#lastName', testUser.lastName);
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);
      await page.fill('#confirmPassword', testUser.password);
      await page.click('button:has-text("Continue to Customer Information")');
      await page.click('button:has-text("Create Account")');

      // Skip passkey setup
      await expect(page.getByRole('heading', { name: 'Account Created!' })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Verify no credentials were stored
      const credentials = await getStoredCredentials(webauthn);
      expect(credentials).toHaveLength(0);

      // Logout - redirects to home page
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
      await page.goto(PAGES.login);

      // Verify passkey button is available
      await expect(page.getByRole('button', { name: 'Sign in with Passkey' })).toBeVisible();

      // User can still login with password
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);
      await page.click('button:has-text("Sign In")');

      // Should successfully login with password
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    } finally {
      await teardownVirtualAuthenticator(webauthn);
    }
  });
});
