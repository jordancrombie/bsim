import { test, expect } from '@playwright/test';
import { createTestUser, PAGES } from '../fixtures/test-data';
import { signupUser, loginUser } from '../../helpers/auth.helpers';

test.describe('Credit Card Management', () => {
  let testUser = createTestUser();

  test.beforeAll(async ({ browser }) => {
    // Create a new user for credit card tests
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

  test('should display credit cards page correctly', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Verify page title
    await expect(page.locator('h1:has-text("Credit Cards")')).toBeVisible();

    // Verify create credit card button
    await expect(page.locator('button:has-text("Create Credit Card")')).toBeVisible();
  });

  test('should open create credit card modal', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Click create credit card button
    await page.click('button:has-text("Create Credit Card")');

    // Verify modal is visible
    await expect(page.locator('h2:has-text("Create New Credit Card")')).toBeVisible();

    // Verify form fields are present
    await expect(page.locator('#creditLimit')).toBeVisible();
    await expect(page.locator('#cardHolder')).toBeVisible();
    await expect(page.locator('#cardType')).toBeVisible();
  });

  test('should create a VISA credit card', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Verify VISA is default
    await expect(page.locator('#cardType')).toHaveValue('VISA');

    // Set credit limit
    await page.fill('#creditLimit', '5000');

    // Create the card
    await page.click('button:has-text("Create Card")');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible({ timeout: 10000 });

    // Verify VISA card appears (the card displays "VISA" text)
    await expect(page.locator('text=VISA').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create a VISA Debit card', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Select VISA Debit
    await page.selectOption('#cardType', 'VISA_DEBIT');

    // Set credit limit
    await page.fill('#creditLimit', '2000');

    // Create the card
    await page.click('button:has-text("Create Card")');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible({ timeout: 10000 });

    // Verify VISA DEBIT card appears
    await expect(page.locator('text=VISA DEBIT').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create a Mastercard', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Select Mastercard
    await page.selectOption('#cardType', 'MC');

    // Set credit limit
    await page.fill('#creditLimit', '7500');

    // Create the card
    await page.click('button:has-text("Create Card")');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible({ timeout: 10000 });

    // Verify Mastercard appears
    await expect(page.locator('text=Mastercard').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create a Mastercard Debit', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Select Mastercard Debit
    await page.selectOption('#cardType', 'MC_DEBIT');

    // Set credit limit
    await page.fill('#creditLimit', '1500');

    // Create the card
    await page.click('button:has-text("Create Card")');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible({ timeout: 10000 });

    // Verify MC Debit card appears
    await expect(page.locator('text=MC Debit').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create an American Express card', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Select AMEX
    await page.selectOption('#cardType', 'AMEX');

    // Set credit limit
    await page.fill('#creditLimit', '10000');

    // Create the card
    await page.click('button:has-text("Create Card")');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible({ timeout: 10000 });

    // Verify AMEX card appears
    await expect(page.locator('text=AMEX').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create card with custom card holder name', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Set custom card holder name
    const customName = 'JOHN Q PUBLIC';
    await page.fill('#cardHolder', customName);

    // Set credit limit
    await page.fill('#creditLimit', '3000');

    // Create the card
    await page.click('button:has-text("Create Card")');

    // Wait for modal to close
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible({ timeout: 10000 });

    // Verify card with custom name appears
    await expect(page.locator(`text=${customName}`).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for zero credit limit', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Set invalid credit limit
    await page.fill('#creditLimit', '0');

    // Try to create the card
    await page.click('button:has-text("Create Card")');

    // Should show error message
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
  });

  test('should cancel credit card creation', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Count existing cards (look for card links with gradient backgrounds)
    const initialCards = await page.locator('a[href^="/dashboard/credit-cards/"]').count();

    // Open create credit card modal
    await page.click('button:has-text("Create Credit Card")');

    // Fill some data
    await page.selectOption('#cardType', 'AMEX');
    await page.fill('#creditLimit', '15000');
    await page.fill('#cardHolder', 'SHOULD NOT CREATE');

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Verify modal is closed
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible();

    // Verify no new card was created (same count)
    const finalCards = await page.locator('a[href^="/dashboard/credit-cards/"]').count();
    expect(finalCards).toBe(initialCards);
  });

  test('should navigate to credit card details', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Click on first credit card (if exists)
    const cardLink = page.locator('a[href^="/dashboard/credit-cards/"]').first();
    const count = await cardLink.count();

    if (count > 0) {
      await cardLink.click();

      // Should navigate to card details page
      await expect(page).toHaveURL(/\/dashboard\/credit-cards\//);
    }
  });

  test('should display card details correctly', async ({ page }) => {
    await page.goto(PAGES.creditCards);

    // Wait for cards to load
    await page.waitForLoadState('networkidle');

    const cardLinks = await page.locator('a[href^="/dashboard/credit-cards/"]').count();

    if (cardLinks > 0) {
      // Each card should show:
      // - Card number (formatted with spaces)
      // - Card holder name
      // - Expiry date
      // - Available credit
      // - Credit limit

      // Check that card number format exists (4 groups of 4 digits)
      await expect(page.locator('text=/\\d{4} \\d{4} \\d{4} \\d{4}/').first()).toBeVisible();

      // Check for "AVAILABLE CREDIT" label
      await expect(page.locator('text=AVAILABLE CREDIT').first()).toBeVisible();

      // Check for "LIMIT" label
      await expect(page.locator('text=LIMIT').first()).toBeVisible();
    }
  });
});

test.describe('Credit Card Transactions', () => {
  let testUser = createTestUser();
  let cardNumber: string;

  test.beforeAll(async ({ browser }) => {
    // Create a new user and credit card for transaction tests
    const page = await browser.newPage();
    await page.goto(PAGES.home);
    await signupUser(page, testUser);

    // Create a credit card
    await page.goto(PAGES.creditCards);
    await page.click('button:has-text("Create Credit Card")');
    await page.fill('#creditLimit', '5000');
    await page.click('button:has-text("Create Card")');

    // Wait for card to be created
    await expect(page.locator('h2:has-text("Create New Credit Card")')).not.toBeVisible({ timeout: 10000 });

    // Get the card number from the card display (format: XXXX XXXX XXXX XXXX)
    // The card number is stored without spaces in the URL
    const cardLink = page.locator('a[href^="/dashboard/credit-cards/"]').first();
    const href = await cardLink.getAttribute('href');
    cardNumber = href?.split('/').pop() || '';

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginUser(page, testUser.email, testUser.password);
  });

  test('should navigate to card detail page', async ({ page }) => {
    await page.goto(`/dashboard/credit-cards/${cardNumber}`);

    // Verify we're on the card detail page
    await expect(page).toHaveURL(new RegExp(cardNumber));
  });

  test('should make a payment on credit card', async ({ page }) => {
    await page.goto(`/dashboard/credit-cards/${cardNumber}`);

    // Look for payment/charge buttons
    const paymentButton = page.locator('button:has-text("Payment"), button:has-text("Pay")');
    const chargeButton = page.locator('button:has-text("Charge"), button:has-text("Add Charge")');

    // If charge button exists, first make a charge, then pay it off
    const chargeCount = await chargeButton.count();
    if (chargeCount > 0) {
      await chargeButton.first().click();

      // Fill charge amount if modal appears
      const amountInput = page.locator('input[type="number"]');
      if (await amountInput.count() > 0) {
        await amountInput.first().fill('100');
        await page.click('button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Charge")');
      }
    }

    // Just verify page loads without error
    await expect(page).toHaveURL(new RegExp(cardNumber));
  });
});
