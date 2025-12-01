import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import { signupUser, loginUser, clearAuthState } from '../../helpers/auth.helpers';

test.describe('Account Management', () => {
  let testUser = createTestUser();

  test.beforeAll(async ({ browser }) => {
    // Create a new user for account tests
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

  test('should display accounts page correctly', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Verify page title
    await expect(page.locator('h1:has-text("Accounts")')).toBeVisible();

    // Verify create account button
    await expect(page.locator('button:has-text("Create Account")')).toBeVisible();
  });

  test('should open create account modal', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Click create account button
    await page.click('button:has-text("Create Account")');

    // Verify modal is visible
    await expect(page.locator('h2:has-text("Create New Account")')).toBeVisible();

    // Verify account type dropdown is present
    await expect(page.locator('#accountType')).toBeVisible();

    // Verify initial balance field is present
    await expect(page.locator('#balance')).toBeVisible();
  });

  test('should create a checking account with initial balance', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Open create account modal
    await page.click('button:has-text("Create Account")');

    // Select account type (default is CHECKING)
    await expect(page.locator('#accountType')).toHaveValue('CHECKING');

    // Set initial balance
    await page.fill('#balance', '500');

    // Create the account
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');

    // Wait for modal to close and account to appear
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    // Verify account appears in the list with Checking type badge
    await expect(page.locator('text=Checking').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=$500.00').first()).toBeVisible();
  });

  test('should create a savings account', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Open create account modal
    await page.click('button:has-text("Create Account")');

    // Select Savings account type
    await page.selectOption('#accountType', 'SAVINGS');

    // Set initial balance
    await page.fill('#balance', '1000');

    // Create the account
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    // Verify savings account appears with type badge
    await expect(page.locator('text=Savings').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=$1000.00').first()).toBeVisible();
  });

  test('should create a money market account', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Open create account modal
    await page.click('button:has-text("Create Account")');

    // Select Money Market account type
    await page.selectOption('#accountType', 'MONEY_MARKET');

    // Set initial balance
    await page.fill('#balance', '2500');

    // Create the account
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    // Verify money market account appears
    await expect(page.locator('text=Money Market').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create a certificate of deposit account', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Open create account modal
    await page.click('button:has-text("Create Account")');

    // Select Certificate of Deposit account type
    await page.selectOption('#accountType', 'CERTIFICATE_OF_DEPOSIT');

    // Set initial balance
    await page.fill('#balance', '10000');

    // Create the account
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    // Verify CD account appears
    await expect(page.locator('text=Certificate of Deposit').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create account with zero balance', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Open create account modal
    await page.click('button:has-text("Create Account")');

    // Leave balance at default 0
    await expect(page.locator('#balance')).toHaveValue('0');

    // Create the account
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    // Verify account appears with $0.00 balance
    await expect(page.locator('text=$0.00').first()).toBeVisible({ timeout: 5000 });
  });

  test('should cancel account creation', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Open create account modal
    await page.click('button:has-text("Create Account")');

    // Verify modal is visible
    await expect(page.locator('h2:has-text("Create New Account")')).toBeVisible();

    // Fill some data
    await page.selectOption('#accountType', 'SAVINGS');
    await page.fill('#balance', '999999');

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Verify modal is closed
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible();

    // Verify no account with $999999 was created (unique amount we used)
    await expect(page.locator('text=$999999.00')).not.toBeVisible();
  });

  test('should navigate to account details', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Click on first account (if exists)
    const accountLink = page.locator('[href^="/dashboard/accounts/ACC-"]').first();
    const count = await accountLink.count();

    if (count > 0) {
      await accountLink.click();

      // Should navigate to account details page
      await expect(page).toHaveURL(/\/dashboard\/accounts\/ACC-/);
    }
  });

  test('should show account type badge on account cards', async ({ page }) => {
    await page.goto(PAGES.accounts);

    // Wait for accounts to load
    await page.waitForLoadState('networkidle');

    // Look for account type badges (at least one should be visible if accounts exist)
    const accountCards = await page.locator('[href^="/dashboard/accounts/ACC-"]').count();

    if (accountCards > 0) {
      // Each account card should have a type badge
      const typeBadges = page.locator('.bg-indigo-100.text-indigo-700');
      await expect(typeBadges.first()).toBeVisible();
    }
  });
});

test.describe('Account Deposits and Withdrawals', () => {
  let testUser = createTestUser();
  let accountNumber: string;

  test.beforeAll(async ({ browser }) => {
    // Create a new user and account for transaction tests
    const page = await browser.newPage();
    await page.goto(PAGES.home);
    await signupUser(page, testUser);

    // Create an account with initial balance
    await page.goto(PAGES.accounts);
    await page.click('button:has-text("Create Account")');
    await page.fill('#balance', '1000');
    await page.click('button:has-text("Create Account"):not(:has-text("+"))');

    // Wait for account to be created and get the account number
    await expect(page.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });

    // Get the account number from the first account card
    const accountLink = page.locator('[href^="/dashboard/accounts/ACC-"]').first();
    const href = await accountLink.getAttribute('href');
    accountNumber = href?.split('/').pop() || '';

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginUser(page, testUser.email, testUser.password);
  });

  test('should deposit funds to account', async ({ page }) => {
    await page.goto(`/dashboard/accounts/${accountNumber}`);

    // Click deposit button to open modal
    await page.click('button:has-text("Deposit")');

    // Wait for modal to appear
    await expect(page.locator('h2:has-text("Deposit Funds")')).toBeVisible();

    // Fill deposit amount using the specific input id
    await page.fill('#amount', '250');

    // Submit deposit - use the second Deposit button (the one in the modal, not the main one)
    await page.locator('button:has-text("Deposit")').nth(1).click();

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Deposit Funds")')).not.toBeVisible({ timeout: 10000 });

    // Verify transaction appears in history
    await expect(page.locator('text=+$250.00').first()).toBeVisible({ timeout: 5000 });
  });

  test('should withdraw funds from account', async ({ page }) => {
    await page.goto(`/dashboard/accounts/${accountNumber}`);

    // Click withdraw button to open modal
    await page.click('button:has-text("Withdraw")');

    // Wait for modal to appear
    await expect(page.locator('h2:has-text("Withdraw Funds")')).toBeVisible();

    // Fill withdrawal amount using the specific input id
    await page.fill('#withdrawAmount', '100');

    // Submit withdrawal - use the second Withdraw button (the one in the modal, not the main one)
    await page.locator('button:has-text("Withdraw")').nth(1).click();

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Withdraw Funds")')).not.toBeVisible({ timeout: 10000 });

    // Verify transaction appears in history
    await expect(page.locator('text=-$100.00').first()).toBeVisible({ timeout: 5000 });
  });
});
