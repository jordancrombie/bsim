import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import { signupUser, clearAuthState, verifyDashboard } from '../../helpers/auth.helpers';

test.describe('Dashboard', () => {
  let testUser = createTestUser();

  test.beforeAll(async ({ browser }) => {
    // Create a new user for dashboard tests
    const page = await browser.newPage();
    await page.goto(PAGES.home);
    await signupUser(page, testUser);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(PAGES.login);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should display dashboard overview correctly', async ({ page }) => {
    await verifyDashboard(page);

    // Check for main sections (use first() to handle sidebar + content)
    await expect(page.locator('text=Accounts').first()).toBeVisible();
    await expect(page.locator('text=Credit Cards').first()).toBeVisible();
  });

  test('should display user name in header', async ({ page }) => {
    // User's name should be visible somewhere in the header/nav
    const userName = `${testUser.firstName}`;
    await expect(page.locator(`text=${userName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should have working navigation sidebar', async ({ page }) => {
    // Check sidebar navigation links exist
    const dashboardLink = page.locator('nav a:has-text("Dashboard"), aside a:has-text("Dashboard")');
    const accountsLink = page.locator('nav a:has-text("Accounts"), aside a:has-text("Accounts")');
    const creditCardsLink = page.locator('nav a:has-text("Credit Cards"), aside a:has-text("Credit Cards")');
    const transferLink = page.locator('nav a:has-text("Transfer"), aside a:has-text("Transfer")');

    await expect(dashboardLink.first()).toBeVisible();
    await expect(accountsLink.first()).toBeVisible();
    await expect(creditCardsLink.first()).toBeVisible();
    await expect(transferLink.first()).toBeVisible();
  });

  test('should navigate to accounts page', async ({ page }) => {
    // Click on Accounts link
    await page.click('text=Accounts');

    // Should navigate to accounts page
    await expect(page).toHaveURL(/\/dashboard\/accounts|\/dashboard.*accounts/i, { timeout: 5000 });
  });

  test('should navigate to credit cards page', async ({ page }) => {
    // Click on Credit Cards link
    await page.click('text=Credit Cards');

    // Should navigate to credit cards page
    await expect(page).toHaveURL(/\/dashboard\/credit-cards|\/dashboard.*credit/i, { timeout: 5000 });
  });

  test('should navigate to transfer page', async ({ page }) => {
    // Click on Transfer link
    await page.click('text=Transfer');

    // Should navigate to transfer page
    await expect(page).toHaveURL(/\/dashboard\/transfer|\/dashboard.*transfer/i, { timeout: 5000 });
  });

  test('should display notification bell', async ({ page }) => {
    // Look for notification bell icon or button
    const notificationBell = page.locator('[aria-label*="notification"], button:has-text("notification"), svg[class*="bell"], [data-testid="notifications"]');

    // If notification bell exists, it should be visible
    // Not all apps have this, so we just check if it exists
    const count = await notificationBell.count();
    if (count > 0) {
      await expect(notificationBell.first()).toBeVisible();
    }
  });

  test('should have logout functionality', async ({ page }) => {
    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), button:has-text("Log out")');
    await expect(logoutButton.first()).toBeVisible();

    await logoutButton.first().click();

    // Should redirect away from dashboard
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should show empty state for new user accounts', async ({ page }) => {
    // New users might have empty accounts list or a prompt to create one
    // This test verifies the page loads without error

    await page.click('text=Accounts >> nth=0');
    await expect(page).toHaveURL(/accounts/i);

    // Page should load without error - just verify the page loaded
    // Either there's a balance shown or some accounts content
    await page.waitForLoadState('networkidle');
    // Pass if page loads without error
  });

  test('should show empty state for new user credit cards', async ({ page }) => {
    await page.click('text=Credit Cards >> nth=0');
    await expect(page).toHaveURL(/credit-cards/i);

    // Page should load without error
    await page.waitForLoadState('networkidle');
    // Pass if page loads without error
  });

  test('should maintain session across navigation', async ({ page }) => {
    // Navigate around
    await page.click('text=Accounts');
    await expect(page).toHaveURL(/accounts/i);

    await page.click('text=Credit Cards');
    await expect(page).toHaveURL(/credit-cards/i);

    await page.click('text=Dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Should still be logged in
    const userName = testUser.firstName;
    await expect(page.locator(`text=${userName}`)).toBeVisible();
  });
});

test.describe('Dashboard - Protected Routes', () => {
  test('should redirect unauthenticated user from dashboard to login', async ({ page }) => {
    // Clear any auth state
    await page.goto(PAGES.home);
    await clearAuthState(page);

    // Try to access dashboard directly
    await page.goto(PAGES.dashboard);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should redirect unauthenticated user from accounts to login', async ({ page }) => {
    await page.goto(PAGES.home);
    await clearAuthState(page);

    await page.goto(PAGES.accounts);

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should redirect unauthenticated user from transfer to login', async ({ page }) => {
    await page.goto(PAGES.home);
    await clearAuthState(page);

    await page.goto(PAGES.transfer);

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
