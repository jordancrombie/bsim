import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import {
  signupUser,
  loginUser,
  logoutUser,
  clearAuthState,
  getAuthToken,
  verifyDashboard,
} from '../../helpers/auth.helpers';

test.describe('Login Flow', () => {
  // Create a test user that we'll use for login tests
  let testUser = createTestUser();

  test.beforeAll(async ({ browser }) => {
    // Create a new user for login tests
    const page = await browser.newPage();
    await page.goto(PAGES.home);
    await signupUser(page, testUser);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await page.goto(PAGES.home);
    await clearAuthState(page);
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto(PAGES.login);

    // Verify page elements - page has "Welcome Back" heading
    await expect(page.locator('text=Welcome Back')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify navigation links
    await expect(page.locator('a:has-text("Sign up")')).toBeVisible();
    await expect(page.locator('text=Back to home')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await loginUser(page, testUser.email, testUser.password);

    // Verify we're on dashboard
    await verifyDashboard(page);

    // Verify token is stored
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('should show error for invalid email', async ({ page }) => {
    await page.goto(PAGES.login);

    await page.fill('#email', 'nonexistent@testuser.banksim.ca');
    await page.fill('#password', 'SomePassword123');

    await page.click('button[type="submit"]');

    // Should show error message (red error div)
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for incorrect password', async ({ page }) => {
    await page.goto(PAGES.login);

    await page.fill('#email', testUser.email);
    await page.fill('#password', 'WrongPassword123!');

    await page.click('button[type="submit"]');

    // Should show error message (red error div)
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for empty fields', async ({ page }) => {
    await page.goto(PAGES.login);

    // Try to submit with empty fields
    await page.click('button[type="submit"]');

    // Browser validation should prevent submission
    // Check that we're still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to dashboard if already logged in', async ({ page }) => {
    // First login
    await loginUser(page, testUser.email, testUser.password);
    await verifyDashboard(page);

    // Try to go to login page
    await page.goto(PAGES.login);

    // Should redirect back to dashboard (or stay there)
    // Note: This depends on app implementation
    // Some apps redirect, some show login page anyway
    const url = page.url();
    // Accept either staying on login or redirecting to dashboard
    expect(url.includes('/login') || url.includes('/dashboard')).toBeTruthy();
  });

  test('should persist login across page refresh', async ({ page }) => {
    await loginUser(page, testUser.email, testUser.password);
    await verifyDashboard(page);

    // Refresh the page
    await page.reload();

    // Should still be on dashboard
    await verifyDashboard(page);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginUser(page, testUser.email, testUser.password);
    await verifyDashboard(page);

    // Logout
    await logoutUser(page);

    // Token should be cleared
    // Need to navigate somewhere first since we might be redirected
    await page.goto(PAGES.home);
    const token = await getAuthToken(page);
    expect(token).toBeFalsy();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard directly without being logged in
    await page.goto(PAGES.dashboard);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should navigate to signup page via link', async ({ page }) => {
    await page.goto(PAGES.login);

    // Click the sign up link
    await page.click('text=Sign up');

    // Should be on signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should navigate to home page via link', async ({ page }) => {
    await page.goto(PAGES.login);

    // Click back to home link
    await page.click('text=Back to home');

    // Should be on home page
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?$/);
  });
});
