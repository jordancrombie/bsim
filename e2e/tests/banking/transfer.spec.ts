import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import { signupUser, loginUser, clearAuthState } from '../../helpers/auth.helpers';

// Configure this test suite to run serially - tests depend on each other
test.describe.configure({ mode: 'serial' });

test.describe('Inter-Customer Transfer', () => {
  // Create two separate test users for the transfer test
  const sender = createTestUser({ firstName: 'Sender', lastName: 'User' });
  const recipient = createTestUser({ firstName: 'Recipient', lastName: 'User' });

  const transferAmount = 150;
  const transferDescription = 'E2E test transfer';

  test.beforeAll(async ({ browser }) => {
    // Create sender with an account that has funds
    const senderPage = await browser.newPage();
    await senderPage.goto(PAGES.home);
    await signupUser(senderPage, sender);

    // Create an account with initial balance for sender
    await senderPage.goto(PAGES.accounts);
    await senderPage.click('button:has-text("Create Account")');
    await senderPage.fill('#balance', '500');
    await senderPage.click('button:has-text("Create Account"):not(:has-text("+"))');
    await expect(senderPage.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });
    await senderPage.close();

    // Create recipient with an account
    const recipientPage = await browser.newPage();
    await recipientPage.goto(PAGES.home);
    await signupUser(recipientPage, recipient);

    // Create an account for recipient (starts with $0)
    await recipientPage.goto(PAGES.accounts);
    await recipientPage.click('button:has-text("Create Account")');
    await recipientPage.click('button:has-text("Create Account"):not(:has-text("+"))');
    await expect(recipientPage.locator('h2:has-text("Create New Account")')).not.toBeVisible({ timeout: 10000 });
    await recipientPage.close();
  });

  test('should display transfer page correctly', async ({ page }) => {
    await loginUser(page, sender.email, sender.password);
    await page.goto(PAGES.transfer);

    // Verify page elements
    await expect(page.locator('h1:has-text("Transfer Money")')).toBeVisible();
    await expect(page.locator('#fromAccount')).toBeVisible();
    await expect(page.locator('#toEmail')).toBeVisible();
    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('button:has-text("Send Transfer")')).toBeVisible();
  });

  test('should show error for invalid recipient email', async ({ page }) => {
    await loginUser(page, sender.email, sender.password);
    await page.goto(PAGES.transfer);

    // Fill form with non-existent email
    await page.fill('#toEmail', 'nonexistent@testuser.banksim.ca');
    await page.fill('#amount', '50');

    // Submit
    await page.click('button:has-text("Send Transfer")');

    // Should show error about recipient not found
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=not found')).toBeVisible();
  });

  test('should show error for insufficient funds', async ({ page }) => {
    await loginUser(page, sender.email, sender.password);
    await page.goto(PAGES.transfer);

    // Fill form with amount greater than balance
    await page.fill('#toEmail', recipient.email);
    await page.fill('#amount', '999999');

    // Submit
    await page.click('button:has-text("Send Transfer")');

    // Should show error about insufficient funds
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Insufficient')).toBeVisible();
  });

  test('should successfully transfer money to another user via email', async ({ page }) => {
    // Login as sender
    await loginUser(page, sender.email, sender.password);

    // Get sender's initial balance
    await page.goto(PAGES.accounts);
    await page.waitForLoadState('networkidle');

    // Note the sender's balance before transfer
    const senderBalanceText = await page.locator('text=$').first().textContent();
    const senderInitialBalance = parseFloat(senderBalanceText?.replace('$', '') || '0');

    // Go to transfer page
    await page.goto(PAGES.transfer);

    // Fill out transfer form
    await page.fill('#toEmail', recipient.email);
    await page.fill('#amount', transferAmount.toString());
    await page.fill('#description', transferDescription);

    // Submit the transfer
    await page.click('button:has-text("Send Transfer")');

    // Verify success message appears
    await expect(page.locator('.bg-green-50')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=Transfer successful`)).toBeVisible();
    await expect(page.locator(`text=$${transferAmount.toFixed(2)}`)).toBeVisible();

    // Verify sender's balance decreased
    await page.goto(PAGES.accounts);
    await page.waitForLoadState('networkidle');

    // The balance should have decreased by the transfer amount
    const expectedSenderBalance = senderInitialBalance - transferAmount;
    await expect(page.locator(`text=$${expectedSenderBalance.toFixed(2)}`).first()).toBeVisible({ timeout: 5000 });
  });

  test('should verify recipient received the transfer', async ({ page }) => {
    // Clear auth state and login as recipient
    await page.goto(PAGES.home);
    await clearAuthState(page);
    await loginUser(page, recipient.email, recipient.password);

    // Go to accounts page
    await page.goto(PAGES.accounts);
    await page.waitForLoadState('networkidle');

    // Recipient should now have the transfer amount in their account
    // (Started with $0, should now have $150)
    await expect(page.locator(`text=$${transferAmount.toFixed(2)}`).first()).toBeVisible({ timeout: 5000 });

    // Click on the account to see transaction history
    const accountLink = page.locator('[href^="/dashboard/accounts/ACC-"]').first();
    await accountLink.click();

    // Verify transfer transaction appears in history
    await expect(page.locator('text=Transfer')).toBeVisible({ timeout: 5000 });

    // The transaction description should contain the transfer description
    await expect(page.locator(`text=${transferDescription}`)).toBeVisible();

    // Verify the amount is visible (transfers don't show +/- signs)
    await expect(page.locator(`text=$${transferAmount.toFixed(2)}`).first()).toBeVisible();
  });

  test('should show transfer in sender transaction history', async ({ page }) => {
    // Login as sender
    await loginUser(page, sender.email, sender.password);

    // Go to accounts and click on the account
    await page.goto(PAGES.accounts);
    await page.waitForLoadState('networkidle');

    const accountLink = page.locator('[href^="/dashboard/accounts/ACC-"]').first();
    await accountLink.click();

    // Verify transfer transaction appears in sender's history
    await expect(page.locator('text=Transfer')).toBeVisible({ timeout: 5000 });

    // The transaction description should contain the transfer description
    // (Format: "Transfer to {email}: {description}")
    await expect(page.locator(`text=${transferDescription}`)).toBeVisible();

    // Verify the transfer amount
    await expect(page.locator(`text=$${transferAmount.toFixed(2)}`).first()).toBeVisible();
  });
});

test.describe('Transfer Page - No Account', () => {
  const noAccountUser = createTestUser({ firstName: 'NoAccount', lastName: 'User' });

  test.beforeAll(async ({ browser }) => {
    // Create user but don't create any accounts
    const page = await browser.newPage();
    await page.goto(PAGES.home);
    await signupUser(page, noAccountUser);
    await page.close();
  });

  test('should show message when user has no accounts', async ({ page }) => {
    await loginUser(page, noAccountUser.email, noAccountUser.password);
    await page.goto(PAGES.transfer);

    // Should show message about needing an account
    await expect(page.locator('text=need an account')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Create an Account')).toBeVisible();
  });
});
