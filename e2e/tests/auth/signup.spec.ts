import { test, expect } from '@playwright/test';
import { createTestUser, TEST_USERS, PAGES } from '../fixtures/test-data';
import { signupUser, verifyDashboard, clearAuthState } from '../../helpers/auth.helpers';

test.describe('Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await page.goto(PAGES.home);
    await clearAuthState(page);
  });

  test('should display signup page correctly', async ({ page }) => {
    await page.goto(PAGES.signup);

    // Verify page title or heading
    await expect(page.locator('text=Create Account')).toBeVisible();

    // Verify step 1 form fields are present
    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#lastName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // Verify auto-generate button is present
    await expect(page.locator('button:has-text("Auto-Generate")')).toBeVisible();

    // Verify navigation links
    await expect(page.locator('text=Sign in')).toBeVisible();
  });

  test('should complete full signup flow with all fields', async ({ page }) => {
    const user = TEST_USERS.standard();

    // Complete signup
    await signupUser(page, user);

    // Verify we're on dashboard
    await verifyDashboard(page);
  });

  test('should complete signup with minimal required fields only', async ({ page }) => {
    const user = TEST_USERS.minimal();

    await page.goto(PAGES.signup);

    // Step 1: Only required fields
    await page.fill('#firstName', user.firstName);
    await page.fill('#lastName', user.lastName);
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.fill('#confirmPassword', user.password);

    // Continue to step 2
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Customer Information')).toBeVisible();

    // Step 2: Skip optional fields, just submit
    await page.click('button[type="submit"]:has-text("Create Account")');

    // Handle passkey prompt if it appears
    const skipButton = page.locator('button:has-text("Skip"), button:has-text("later")');
    try {
      await skipButton.first().click({ timeout: 3000 });
    } catch {
      // Passkey prompt didn't appear
    }

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should show validation error for mismatched passwords', async ({ page }) => {
    await page.goto(PAGES.signup);

    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#email', 'test@testuser.banksim.ca');
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'DifferentPassword!');

    // Try to continue
    await page.click('button[type="submit"]');

    // Should show error message about passwords not matching
    await expect(page.locator('text=match')).toBeVisible({ timeout: 5000 });

    // Should still be on step 1 (not advanced to step 2)
    await expect(page.locator('#firstName')).toBeVisible();
  });

  test('should show validation error for short password', async ({ page }) => {
    await page.goto(PAGES.signup);

    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#email', 'test@testuser.banksim.ca');
    await page.fill('#password', '12345'); // Too short (< 6 chars)
    await page.fill('#confirmPassword', '12345');

    await page.click('button[type="submit"]');

    // Should show error about password length (red error div)
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
  });

  test('should allow going back from step 2 to step 1', async ({ page }) => {
    const user = createTestUser();

    await page.goto(PAGES.signup);

    // Complete step 1
    await page.fill('#firstName', user.firstName);
    await page.fill('#lastName', user.lastName);
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.fill('#confirmPassword', user.password);

    await page.click('button[type="submit"]');

    // Wait for step 2
    await expect(page.locator('text=Customer Information')).toBeVisible();

    // Click back button
    await page.click('button:has-text("Back")');

    // Should be back on step 1 with data preserved
    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#firstName')).toHaveValue(user.firstName);
    await expect(page.locator('#email')).toHaveValue(user.email);
  });

  test('should auto-generate test data when button clicked', async ({ page }) => {
    await page.goto(PAGES.signup);

    // Fields should be empty initially
    await expect(page.locator('#firstName')).toHaveValue('');

    // Click auto-generate button
    await page.click('button:has-text("Auto-Generate")');

    // Fields should now be filled
    await expect(page.locator('#firstName')).not.toHaveValue('');
    await expect(page.locator('#lastName')).not.toHaveValue('');
    await expect(page.locator('#email')).not.toHaveValue('');
    await expect(page.locator('#password')).not.toHaveValue('');
  });

  test('should show error for duplicate email', async ({ page }) => {
    // First, create a user
    const user = createTestUser();
    await signupUser(page, user);

    // Clear auth and try to sign up with same email
    await clearAuthState(page);
    await page.goto(PAGES.signup);

    // Try to sign up with same email
    await page.fill('#firstName', 'Another');
    await page.fill('#lastName', 'User');
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.fill('#confirmPassword', user.password);

    await page.click('button[type="submit"]');

    // Wait for step 2
    await expect(page.locator('text=Customer Information')).toBeVisible();

    // Submit step 2
    await page.click('button[type="submit"]:has-text("Create Account")');

    // Should show error about email already in use
    await expect(page.locator('text=already')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to login page via link', async ({ page }) => {
    await page.goto(PAGES.signup);

    // Click the sign in link
    await page.click('text=Sign in');

    // Should be on login page
    await expect(page).toHaveURL(/\/login/);
  });
});
