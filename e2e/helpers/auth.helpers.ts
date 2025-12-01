import { Page, expect } from '@playwright/test';
import { TestUser, PAGES } from '../tests/fixtures/test-data';

/**
 * Authentication helper functions for E2E tests
 */

/**
 * Complete the full signup flow for a new user
 * @param page - Playwright page object
 * @param user - Test user data
 * @param options - Additional options
 */
export async function signupUser(
  page: Page,
  user: TestUser,
  options: {
    skipPasskeyPrompt?: boolean;
  } = { skipPasskeyPrompt: true }
): Promise<void> {
  // Navigate to signup page
  await page.goto(PAGES.signup);

  // Step 1: Account Information
  await page.fill('#firstName', user.firstName);
  await page.fill('#lastName', user.lastName);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.fill('#confirmPassword', user.password);

  // Click continue to step 2
  await page.click('button[type="submit"]');

  // Wait for step 2 to load
  await expect(page.locator('text=Customer Information')).toBeVisible();

  // Step 2: Customer Information (optional fields)
  if (user.phone) {
    await page.fill('#phone', user.phone);
  }
  if (user.dateOfBirth) {
    await page.fill('#dateOfBirth', user.dateOfBirth);
  }
  if (user.address) {
    await page.fill('#address', user.address);
  }
  if (user.city) {
    await page.fill('#city', user.city);
  }
  if (user.state) {
    await page.selectOption('#state', user.state);
  }
  if (user.postalCode) {
    await page.fill('#postalCode', user.postalCode);
  }

  // Submit signup form
  await page.click('button[type="submit"]:has-text("Create Account")');

  // Handle passkey prompt if it appears
  if (options.skipPasskeyPrompt) {
    // Look for "Skip for now" or similar button, but don't fail if not present
    const skipButton = page.locator('button:has-text("Skip"), button:has-text("skip"), button:has-text("later"), button:has-text("Later")');
    try {
      await skipButton.first().click({ timeout: 3000 });
    } catch {
      // Passkey prompt didn't appear, that's fine
    }
  }

  // Verify we reached the dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Login with email and password
 * @param page - Playwright page object
 * @param email - User email
 * @param password - User password
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  // Navigate to login page
  await page.goto(PAGES.login);

  // Fill in credentials
  await page.fill('#email', email);
  await page.fill('#password', password);

  // Submit login form
  await page.click('button[type="submit"]');

  // Verify we reached the dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Logout the current user
 * @param page - Playwright page object
 */
export async function logoutUser(page: Page): Promise<void> {
  // Look for logout button in the dashboard header
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), button:has-text("Log out")');
  await logoutButton.first().click();

  // Verify we're redirected to home or login
  await expect(page).toHaveURL(/\/(login)?$/, { timeout: 10000 });
}

/**
 * Check if user is logged in by verifying dashboard access
 * @param page - Playwright page object
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto(PAGES.dashboard);
    // If we can access dashboard without redirect, we're logged in
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear authentication state (localStorage token)
 * @param page - Playwright page object
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('token');
  });
}

/**
 * Get the current auth token from localStorage
 * @param page - Playwright page object
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return localStorage.getItem('token');
  });
}

/**
 * Verify user is on the dashboard with expected elements
 * @param page - Playwright page object
 * @param userName - Expected user name to display (optional)
 */
export async function verifyDashboard(
  page: Page,
  userName?: string
): Promise<void> {
  // Check we're on dashboard
  await expect(page).toHaveURL(/\/dashboard/);

  // If userName provided, verify it's displayed
  if (userName) {
    await expect(page.locator(`text=${userName}`)).toBeVisible();
  }

  // Verify navigation sidebar elements (use first() to handle multiple matches)
  await expect(page.locator('text=Accounts').first()).toBeVisible();
  await expect(page.locator('text=Credit Cards').first()).toBeVisible();
}
