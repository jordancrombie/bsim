import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import { signupUser } from '../../helpers/auth.helpers';

/**
 * Open Banking OIDC Flow Tests
 *
 * These tests validate the complete OAuth 2.0/OIDC flow between:
 * - SSIM (Store Simulator) - Third-party application
 * - BSIM Auth Server - Authorization server
 * - BSIM Open Banking API - Resource server
 *
 * Flow:
 * 1. User visits SSIM and initiates login
 * 2. SSIM redirects to BSIM auth server
 * 3. User authenticates with BSIM credentials
 * 4. User grants consent for requested scopes
 * 5. SSIM receives authorization code and exchanges for tokens
 * 6. User sees their profile/account data in SSIM
 *
 * IMPORTANT: These tests require SSIM (or another OIDC client) to be running.
 * They validate BSIM's auth server and Open Banking APIs from the perspective
 * of a third-party application. The tests are kept in the BSIM repo to ensure
 * complete coverage of BSIM's OIDC/OAuth flows.
 *
 * DESIGN NOTE: These tests are atomic and self-contained.
 * Each test suite creates its own BSIM users via beforeAll hooks rather than
 * depending on users created by other test suites. This ensures:
 * - Tests can run in any order
 * - Tests can run in parallel across workers without conflicts
 * - Individual test files can be run in isolation
 * - No cleanup coordination is needed between suites
 */

// Configure serial execution - these tests depend on each other
test.describe.configure({ mode: 'serial' });

// URLs for the OIDC flow
// Note: We use actual domain names because Playwright doesn't support custom Host headers
const SSIM_BASE = process.env.SSIM_URL || 'https://ssim-dev.banksim.ca';

test.describe('Open Banking OIDC Flow', () => {
  // Create a test user for the OIDC flow
  const testUser = createTestUser({ firstName: 'OpenBanking', lastName: 'TestUser' });

  test.beforeAll(async ({ browser }) => {
    // Create a user in BSIM with an account
    const page = await browser.newPage();
    await page.goto(PAGES.home);
    await signupUser(page, testUser);

    // Create an account with funds for the user
    await page.goto(PAGES.accounts);
    await page.click('button:has-text("Create Account")');
    await page.selectOption('#accountType', 'SAVINGS');
    await page.fill('#balance', '2500');
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    await page.close();
  });

  test('should display SSIM homepage correctly', async ({ page }) => {
    // Navigate to SSIM
    await page.goto(SSIM_BASE);

    // Verify SSIM homepage loads
    await expect(page.getByRole('heading', { name: /Welcome to SSIM/i })).toBeVisible();
    await expect(page.getByText('Store Simulator', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  });

  test('should show login options on SSIM login page', async ({ page }) => {
    await page.goto(`${SSIM_BASE}/login`);

    // Verify login page elements
    await expect(page.locator('text=Login to SSIM')).toBeVisible();
    await expect(page.locator('text=Continue with BSIM Bank')).toBeVisible();
  });

  test('should redirect to BSIM auth server when clicking login', async ({ page }) => {
    await page.goto(`${SSIM_BASE}/login`);

    // Click the BSIM login button
    await page.click('text=Continue with BSIM Bank');

    // Should redirect to auth server login page
    // Wait for the auth server URL (it includes /interaction/ in the path)
    await expect(page).toHaveURL(/auth.*\.banksim\.ca\/interaction\//, { timeout: 10000 });

    // Verify we see the auth server login form
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Should show the client name (SSIM)
    await expect(page.getByText('SSIM - Store Simulator', { exact: true })).toBeVisible();
  });

  test('should complete full OIDC flow and show user data in SSIM', async ({ page }) => {
    // Start the OIDC flow from SSIM
    await page.goto(`${SSIM_BASE}/login`);

    // Click login with BSIM
    await page.click('text=Continue with BSIM Bank');

    // Wait for auth server login page
    await expect(page).toHaveURL(/auth.*\.banksim\.ca\/interaction\//, { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[type="email"], input[name="email"]', testUser.email);
    await page.fill('input[type="password"], input[name="password"]', testUser.password);

    // Submit login
    await page.click('button[type="submit"]');

    // Should see consent page after login
    // Look for consent-related elements (permissions list, authorize button)
    await expect(page.getByRole('button', { name: 'Authorize' })).toBeVisible({ timeout: 10000 });

    // Verify consent page shows requested permissions
    await expect(page.getByRole('heading', { name: 'Authorize Access' })).toBeVisible();

    // Verify account selection is shown (if accounts exist)
    const accountCheckboxes = page.locator('input[name="selectedAccounts"]');
    const accountCount = await accountCheckboxes.count();
    if (accountCount > 0) {
      // Check all accounts
      for (let i = 0; i < accountCount; i++) {
        await accountCheckboxes.nth(i).check();
      }
    }

    // Click Authorize button
    await page.getByRole('button', { name: 'Authorize' }).click();

    // Should redirect back to SSIM after authorization
    // Wait for redirect to complete - SSIM should show logged in state
    await expect(page).toHaveURL(/ssim.*\.banksim\.ca/, { timeout: 15000 });

    // Verify user is logged in - should see user info
    await expect(page.getByRole('heading', { name: `${testUser.firstName} ${testUser.lastName}` })).toBeVisible({ timeout: 10000 });
  });

  test('should show user account data after successful OIDC flow', async ({ page }) => {
    // Start fresh OIDC flow
    await page.goto(`${SSIM_BASE}/login`);

    // Login with BSIM
    await page.click('text=Continue with BSIM Bank');
    await expect(page).toHaveURL(/auth.*\.banksim\.ca\/interaction\//, { timeout: 10000 });

    // Enter credentials
    await page.fill('input[type="email"], input[name="email"]', testUser.email);
    await page.fill('input[type="password"], input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Handle consent page
    await expect(page.getByRole('button', { name: 'Authorize' })).toBeVisible({ timeout: 10000 });

    // Select all accounts if shown
    const accountCheckboxes = page.locator('input[name="selectedAccounts"]');
    const accountCount = await accountCheckboxes.count();
    for (let i = 0; i < accountCount; i++) {
      await accountCheckboxes.nth(i).check();
    }

    // Authorize
    await page.getByRole('button', { name: 'Authorize' }).click();

    // Wait for SSIM to load with user data
    await expect(page).toHaveURL(/ssim.*\.banksim\.ca/, { timeout: 15000 });

    // Look for user profile data displayed in SSIM
    // SSIM should display the user's profile information retrieved via Open Banking API
    await expect(page.getByRole('heading', { name: `${testUser.firstName} ${testUser.lastName}` })).toBeVisible({ timeout: 10000 });

    // Verify the granted scopes are displayed
    await expect(page.getByText('fdx:accountdetailed:read')).toBeVisible();
  });

  test('should fetch accounts via KENOK Open Banking page', async ({ page }) => {
    // Complete the OIDC login flow first
    await page.goto(`${SSIM_BASE}/login`);
    await page.click('text=Continue with BSIM Bank');
    await expect(page).toHaveURL(/auth.*\.banksim\.ca\/interaction\//, { timeout: 10000 });

    await page.fill('input[type="email"], input[name="email"]', testUser.email);
    await page.fill('input[type="password"], input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Handle consent page
    await expect(page.getByRole('button', { name: 'Authorize' })).toBeVisible({ timeout: 10000 });

    // Select all accounts if shown
    const accountCheckboxes = page.locator('input[name="selectedAccounts"]');
    const accountCount = await accountCheckboxes.count();
    for (let i = 0; i < accountCount; i++) {
      await accountCheckboxes.nth(i).check();
    }

    await page.getByRole('button', { name: 'Authorize' }).click();
    await expect(page).toHaveURL(/ssim.*\.banksim\.ca/, { timeout: 15000 });

    // Now click on KENOK in the navigation
    await page.getByRole('link', { name: 'KENOK' }).click();

    // Verify we're on the KENOK page
    await expect(page.getByRole('heading', { name: 'KENOK' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Open Banking Account Access')).toBeVisible();

    // Click "Fetch My Accounts from BSIM" button
    await page.getByRole('button', { name: 'Fetch My Accounts from BSIM' }).click();

    // Wait for accounts to load - should see "Your Accounts" heading
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible({ timeout: 10000 });

    // Verify account data is displayed
    // The test user created a SAVINGS account with $2500 balance in beforeAll
    await expect(page.getByText('SAVINGS', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('$2,500.00').first()).toBeVisible();

    // Verify raw API response section is shown
    await expect(page.getByText('Raw API Response')).toBeVisible();
  });

  test('should be able to deny authorization', async ({ page }) => {
    // Start OIDC flow
    await page.goto(`${SSIM_BASE}/login`);

    await page.click('text=Continue with BSIM Bank');
    await expect(page).toHaveURL(/auth.*\.banksim\.ca\/interaction\//, { timeout: 10000 });

    // Login
    await page.fill('input[type="email"], input[name="email"]', testUser.email);
    await page.fill('input[type="password"], input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Wait for consent page
    await expect(page.getByRole('button', { name: 'Authorize' })).toBeVisible({ timeout: 10000 });

    // Click Deny button
    await page.getByRole('button', { name: 'Deny' }).click();

    // Should redirect back to SSIM with an error
    await expect(page).toHaveURL(/ssim.*\.banksim\.ca/, { timeout: 15000 });

    // Should show error message about denied authorization
    await expect(page.getByText('access_denied')).toBeVisible({ timeout: 5000 });
  });

  test('should handle invalid credentials on auth server', async ({ page }) => {
    await page.goto(`${SSIM_BASE}/login`);

    await page.click('text=Continue with BSIM Bank');
    await expect(page).toHaveURL(/auth.*\.banksim\.ca\/interaction\//, { timeout: 10000 });

    // Enter invalid credentials
    await page.fill('input[type="email"], input[name="email"]', 'nonexistent@testuser.banksim.ca');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error on auth server page
    await expect(page.locator('text=Invalid').or(page.locator('text=incorrect').or(page.locator('.error')))).toBeVisible({ timeout: 10000 });

    // Should still be on auth server (not redirected)
    await expect(page).toHaveURL(/auth.*\.banksim\.ca/, { timeout: 5000 });
  });
});

test.describe('SSIM Post-Login Features', () => {
  const testUser = createTestUser({ firstName: 'SSIMTest', lastName: 'User' });

  test.beforeAll(async ({ browser }) => {
    // Create user with account
    const page = await browser.newPage();
    await page.goto(PAGES.home);
    await signupUser(page, testUser);

    await page.goto(PAGES.accounts);
    await page.click('button:has-text("Create Account")');
    await page.fill('#balance', '1000');
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    await page.close();
  });

  test('should be able to logout from SSIM', async ({ page }) => {
    // First, complete the login flow
    await page.goto(`${SSIM_BASE}/login`);

    await page.click('text=Continue with BSIM Bank');
    await expect(page).toHaveURL(/auth.*\.banksim\.ca\/interaction\//, { timeout: 10000 });

    await page.fill('input[type="email"], input[name="email"]', testUser.email);
    await page.fill('input[type="password"], input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await expect(page.getByRole('button', { name: 'Authorize' })).toBeVisible({ timeout: 10000 });

    const accountCheckboxes = page.locator('input[name="selectedAccounts"]');
    const accountCount = await accountCheckboxes.count();
    for (let i = 0; i < accountCount; i++) {
      await accountCheckboxes.nth(i).check();
    }

    await page.getByRole('button', { name: 'Authorize' }).click();
    await expect(page).toHaveURL(/ssim.*\.banksim\.ca/, { timeout: 15000 });

    // Now logout (use the nav bar logout link)
    await page.getByRole('navigation').getByRole('link', { name: 'Logout' }).click();

    // Auth server shows logout confirmation page
    await expect(page.getByRole('button', { name: 'Yes, sign me out' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Yes, sign me out' }).click();

    // Should redirect back to SSIM and be logged out
    await expect(page).toHaveURL(/ssim.*\.banksim\.ca/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible({ timeout: 5000 });
  });
});
