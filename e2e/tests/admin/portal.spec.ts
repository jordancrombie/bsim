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
  teardownVirtualAuthenticator,
  WebAuthnContext,
} from '../../helpers/webauthn.helpers';

/**
 * Admin Portal E2E Tests
 *
 * These tests validate the admin portal functionality:
 * - Dashboard with statistics
 * - Users management (view list, view details)
 * - Admins management (view list, view details)
 * - Card Types management (view, create, edit, toggle status)
 * - Account Types management (view, create, edit, toggle status)
 *
 * IMPORTANT: These tests only run on Chromium because they use Chrome DevTools
 * Protocol (CDP) to create a virtual WebAuthn authenticator for admin login.
 *
 * Tests avoid modifying settings as those changes cannot be safely reverted.
 */

// Configure serial execution - tests depend on authenticated session
test.describe.configure({ mode: 'serial' });

test.describe('Admin Portal Functionality', () => {
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

  test.describe('Dashboard', () => {
    test('should display dashboard with statistics after login', async ({ page }) => {
      // Create and register an admin
      const testAdmin = createTestAdmin({ firstName: 'Dashboard', lastName: 'Test' });
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

      // Verify dashboard heading
      await expect(page.getByRole('heading', { name: /Admin Dashboard/i })).toBeVisible({ timeout: 10000 });

      // Verify statistics cards are visible (use .first() to avoid matching Quick Actions)
      await expect(page.getByText(/Total Users/i).first()).toBeVisible();
      await expect(page.getByText(/Bank Accounts/i).first()).toBeVisible();
      await expect(page.getByText(/Credit Cards/i).first()).toBeVisible();
      // "Admin Users" appears in both stats card and Quick Actions - get the stats card version
      await expect(page.locator('.text-gray-500').getByText(/Admin Users/i)).toBeVisible();

      // Verify Quick Actions section
      await expect(page.getByRole('heading', { name: /Quick Actions/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /View All Users/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /View Admin Users/i })).toBeVisible();
    });
  });

  test.describe('Users Management', () => {
    test('should navigate to users page and display user list', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'Users', lastName: 'Viewer' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Users page
      await page.getByRole('link', { name: /View All Users/i }).click();

      // Verify Users page
      await expect(page.getByRole('heading', { name: /^Users$/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/total users/i)).toBeVisible();

      // Verify table headers are present
      await expect(page.getByRole('columnheader', { name: /User/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Accounts/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Credit Cards/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Passkeys/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Created/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Actions/i })).toBeVisible();
    });

    test('should view user details when clicking View Details', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'UserDetail', lastName: 'Viewer' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Users page via sidebar link (maintains session)
      await page.getByRole('link', { name: /^Users$/i }).click();
      await expect(page.getByRole('heading', { name: /^Users$/i })).toBeVisible({ timeout: 10000 });

      // Check if there are users to view
      const viewDetailsLinks = page.getByRole('link', { name: /View Details/i });
      const count = await viewDetailsLinks.count();

      if (count > 0) {
        // Click the first View Details link
        await viewDetailsLinks.first().click();

        // Verify user detail page
        await expect(page.getByText(/Back to Users/i)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/User ID/i)).toBeVisible();
        await expect(page.getByText(/Customer Information File/i)).toBeVisible();
        await expect(page.getByText(/Bank Accounts/i).first()).toBeVisible();
        await expect(page.getByText(/Credit Cards/i).first()).toBeVisible();
        await expect(page.getByText(/Passkeys/i).first()).toBeVisible();
      } else {
        // No users, verify empty state message
        await expect(page.getByText(/No users/i)).toBeVisible();
      }
    });
  });

  test.describe('Admins Management', () => {
    test('should navigate to admins page and display admin list', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'Admins', lastName: 'Viewer' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Admins page
      await page.getByRole('link', { name: /View Admin Users/i }).click();

      // Verify Admins page
      await expect(page.getByRole('heading', { name: /Admin Users/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/total admins/i)).toBeVisible();

      // Verify table headers are present
      await expect(page.getByRole('columnheader', { name: /Admin/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Role/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Passkeys/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Created/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Actions/i })).toBeVisible();

      // Verify the test admin we created is in the list
      await expect(page.getByText(testAdmin.email)).toBeVisible();
    });

    test('should view admin details when clicking View Details', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'AdminDetail', lastName: 'Viewer' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Admins page via sidebar
      await page.getByRole('link', { name: /^Admins$/i }).click();
      await expect(page.getByRole('heading', { name: /Admin Users/i })).toBeVisible({ timeout: 10000 });

      // Click the first View Details link
      const viewDetailsLinks = page.getByRole('link', { name: /View Details/i });
      await viewDetailsLinks.first().click();

      // Verify admin detail page
      await expect(page.getByText(/Back to Admin Users/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Admin ID/i)).toBeVisible();
      await expect(page.getByText(/Role/i).first()).toBeVisible();
      await expect(page.getByText(/Passkeys/i).first()).toBeVisible();
    });
  });

  test.describe('Card Types Management', () => {
    test('should display card types page with list of card types', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'CardTypes', lastName: 'Viewer' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Card Types page via sidebar
      await page.getByRole('link', { name: /Card Types/i }).click();

      // Verify Card Types page
      await expect(page.getByRole('heading', { name: /Credit Card Types/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Manage the types of credit cards/i)).toBeVisible();

      // Verify Add button is present
      await expect(page.getByRole('button', { name: /Add Card Type/i })).toBeVisible();

      // Verify table headers are present
      await expect(page.getByRole('columnheader', { name: /Order/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Code/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Name/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Card Number Prefix/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Length/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /CVV/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Type/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Actions/i })).toBeVisible();
    });

    test('should open and close add card type modal', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'CardModal', lastName: 'Tester' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Card Types page via sidebar
      await page.getByRole('link', { name: /Card Types/i }).click();
      await expect(page.getByRole('heading', { name: /Credit Card Types/i })).toBeVisible({ timeout: 10000 });

      // Click Add Card Type button
      await page.getByRole('button', { name: /Add Card Type/i }).click();

      // Verify modal opens
      await expect(page.getByRole('heading', { name: /Add New Card Type/i })).toBeVisible({ timeout: 5000 });

      // Verify form fields are present (using placeholder text as inputs don't have proper labels)
      await expect(page.getByPlaceholder('VISA').first()).toBeVisible();
      await expect(page.getByPlaceholder('4 or 51,52,53,54,55')).toBeVisible();

      // Verify checkboxes are present
      await expect(page.getByRole('checkbox', { name: /Debit Card/i })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: /Active/i })).toBeVisible();

      // Click Cancel to close modal
      await page.getByRole('button', { name: /Cancel/i }).click();

      // Verify modal is closed
      await expect(page.getByRole('heading', { name: /Add New Card Type/i })).not.toBeVisible();
    });

    test('should open edit modal when clicking Edit on existing card type', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'CardEdit', lastName: 'Tester' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Card Types page via sidebar
      await page.getByRole('link', { name: /Card Types/i }).click();
      await expect(page.getByRole('heading', { name: /Credit Card Types/i })).toBeVisible({ timeout: 10000 });

      // Check if there are card types to edit
      const editButtons = page.getByRole('button', { name: /^Edit$/i });
      const count = await editButtons.count();

      if (count > 0) {
        // Click the first Edit button
        await editButtons.first().click();

        // Verify edit modal opens (use exact match to avoid matching "Credit Card Types")
        await expect(page.getByRole('heading', { name: 'Edit Card Type', exact: true })).toBeVisible({ timeout: 5000 });

        // Verify code field is disabled (cannot change code) - using placeholder "VISA"
        const codeInput = page.getByPlaceholder('VISA').first();
        await expect(codeInput).toBeDisabled();

        // Click Cancel to close modal
        await page.getByRole('button', { name: /Cancel/i }).click();
      } else {
        // No card types, verify empty state
        await expect(page.getByText(/No card types/i)).toBeVisible();
      }
    });

    test('should create inactive card type and then delete it', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'CardCRUD', lastName: 'Tester' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Card Types page via sidebar
      await page.getByRole('link', { name: /Card Types/i }).click();
      await expect(page.getByRole('heading', { name: /Credit Card Types/i })).toBeVisible({ timeout: 10000 });

      // Click Add Card Type button
      await page.getByRole('button', { name: /Add Card Type/i }).click();
      await expect(page.getByRole('heading', { name: /Add New Card Type/i })).toBeVisible({ timeout: 5000 });

      // Generate unique test card type code
      const testCode = `TEST_${Date.now()}`;
      const testName = 'E2E Test Card';

      // Fill in the form
      await page.getByPlaceholder('VISA').first().fill(testCode);
      await page.getByPlaceholder('VISA').nth(1).fill(testName); // Display Name field
      await page.getByPlaceholder('4 or 51,52,53,54,55').fill('99');

      // Uncheck Active checkbox to create inactive card type
      const activeCheckbox = page.getByRole('checkbox', { name: /Active/i });
      if (await activeCheckbox.isChecked()) {
        await activeCheckbox.uncheck();
      }

      // Click Create button
      await page.getByRole('button', { name: /Create/i }).click();

      // Wait for success message and modal to close
      await expect(page.getByText(/Card type created successfully/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('heading', { name: /Add New Card Type/i })).not.toBeVisible({ timeout: 5000 });

      // Verify the new card type appears in the table
      await expect(page.getByText(testCode)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(testName)).toBeVisible();

      // Find the row with our test card and click Delete
      const testRow = page.locator('tr', { has: page.getByText(testCode) });

      // Set up dialog handler for confirmation
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Click the Delete button in that row
      await testRow.getByRole('button', { name: /Delete/i }).click();

      // Wait for success message
      await expect(page.getByText(/Card type deleted successfully/i)).toBeVisible({ timeout: 5000 });

      // Verify the card type is no longer in the table
      await expect(page.getByText(testCode)).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Account Types Management', () => {
    test('should display account types page with list of account types', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'AccountTypes', lastName: 'Viewer' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Account Types page via sidebar
      await page.getByRole('link', { name: /Account Types/i }).click();

      // Verify Account Types page
      await expect(page.getByRole('heading', { name: /Account Types/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Manage the types of bank accounts/i)).toBeVisible();

      // Verify Add button is present
      await expect(page.getByRole('button', { name: /Add Account Type/i })).toBeVisible();

      // Verify table headers are present
      await expect(page.getByRole('columnheader', { name: /Order/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Code/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Name/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Description/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Actions/i })).toBeVisible();
    });

    test('should open and close add account type modal', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'AcctModal', lastName: 'Tester' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Account Types page via sidebar
      await page.getByRole('link', { name: /Account Types/i }).click();
      await expect(page.getByRole('heading', { name: /Account Types/i })).toBeVisible({ timeout: 10000 });

      // Click Add Account Type button
      await page.getByRole('button', { name: /Add Account Type/i }).click();

      // Verify modal opens
      await expect(page.getByRole('heading', { name: /Add New Account Type/i })).toBeVisible({ timeout: 5000 });

      // Verify form fields are present (using placeholder text with exact match)
      await expect(page.getByPlaceholder('CHECKING', { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('Checking Account', { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('Optional description of this account type')).toBeVisible();

      // Verify checkbox is present
      await expect(page.getByRole('checkbox', { name: /Active/i })).toBeVisible();

      // Click Cancel to close modal
      await page.getByRole('button', { name: /Cancel/i }).click();

      // Verify modal is closed
      await expect(page.getByRole('heading', { name: /Add New Account Type/i })).not.toBeVisible();
    });

    test('should open edit modal when clicking Edit on existing account type', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'AcctEdit', lastName: 'Tester' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Account Types page via sidebar
      await page.getByRole('link', { name: /Account Types/i }).click();
      await expect(page.getByRole('heading', { name: /Account Types/i })).toBeVisible({ timeout: 10000 });

      // Check if there are account types to edit
      const editButtons = page.getByRole('button', { name: /^Edit$/i });
      const count = await editButtons.count();

      if (count > 0) {
        // Click the first Edit button
        await editButtons.first().click();

        // Verify edit modal opens
        await expect(page.getByRole('heading', { name: /Edit Account Type/i })).toBeVisible({ timeout: 5000 });

        // Verify code field is disabled (cannot change code) - using placeholder "CHECKING" with exact match
        const codeInput = page.getByPlaceholder('CHECKING', { exact: true });
        await expect(codeInput).toBeDisabled();

        // Click Cancel to close modal
        await page.getByRole('button', { name: /Cancel/i }).click();
      } else {
        // No account types, verify empty state
        await expect(page.getByText(/No account types/i)).toBeVisible();
      }
    });

    test('should create inactive account type and then delete it', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'AcctCRUD', lastName: 'Tester' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Account Types page via sidebar
      await page.getByRole('link', { name: /Account Types/i }).click();
      await expect(page.getByRole('heading', { name: /Account Types/i })).toBeVisible({ timeout: 10000 });

      // Click Add Account Type button
      await page.getByRole('button', { name: /Add Account Type/i }).click();
      await expect(page.getByRole('heading', { name: /Add New Account Type/i })).toBeVisible({ timeout: 5000 });

      // Generate unique test account type code
      const testCode = `TEST_${Date.now()}`;
      const testName = 'E2E Test Account';
      const testDesc = 'Test account type created by E2E tests';

      // Fill in the form
      await page.getByPlaceholder('CHECKING', { exact: true }).fill(testCode);
      await page.getByPlaceholder('Checking Account', { exact: true }).fill(testName);
      await page.getByPlaceholder('Optional description of this account type').fill(testDesc);

      // Uncheck Active checkbox to create inactive account type
      const activeCheckbox = page.getByRole('checkbox', { name: /Active/i });
      if (await activeCheckbox.isChecked()) {
        await activeCheckbox.uncheck();
      }

      // Click Create button
      await page.getByRole('button', { name: /Create/i }).click();

      // Wait for success message and modal to close
      await expect(page.getByText(/Account type created successfully/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('heading', { name: /Add New Account Type/i })).not.toBeVisible({ timeout: 5000 });

      // Verify the new account type appears in the table
      await expect(page.getByText(testCode)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(testName)).toBeVisible();

      // Find the row with our test account type and click Delete
      const testRow = page.locator('tr', { has: page.getByText(testCode) });

      // Set up dialog handler for confirmation
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Click the Delete button in that row
      await testRow.getByRole('button', { name: /Delete/i }).click();

      // Wait for success message
      await expect(page.getByText(/Account type deleted successfully/i)).toBeVisible({ timeout: 5000 });

      // Verify the account type is no longer in the table
      await expect(page.getByText(testCode)).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Navigation', () => {
    test('should navigate between admin portal sections via sidebar', async ({ page }) => {
      // Create and login admin
      const testAdmin = createTestAdmin({ firstName: 'Navigation', lastName: 'Tester' });
      const invite = await createTestAdminInvite(testAdmin.email);

      await page.goto(`${adminUrl}${ADMIN_PAGES.invite}?code=${invite.code}`);
      await expect(page.getByRole('heading', { name: /Create Admin Account/i })).toBeVisible({ timeout: 10000 });

      await page.getByRole('textbox', { name: /first name/i }).fill(testAdmin.firstName);
      await page.getByRole('textbox', { name: /last name/i }).fill(testAdmin.lastName);

      await simulatePasskeySuccess(webauthn, async () => {
        await page.getByRole('button', { name: /Create Account with Passkey/i }).click();
      });

      await expect(page).toHaveURL(new RegExp(`${adminUrl.replace(/\./g, '\\.')}/?`), { timeout: 15000 });

      // Navigate to Users via sidebar
      await page.getByRole('link', { name: /^Users$/i }).click();
      await expect(page.getByRole('heading', { name: /^Users$/i })).toBeVisible({ timeout: 10000 });

      // Navigate to Admins via sidebar
      await page.getByRole('link', { name: /^Admins$/i }).click();
      await expect(page.getByRole('heading', { name: /Admin Users/i })).toBeVisible({ timeout: 10000 });

      // Navigate to Card Types via sidebar
      await page.getByRole('link', { name: /Card Types/i }).click();
      await expect(page.getByRole('heading', { name: /Credit Card Types/i })).toBeVisible({ timeout: 10000 });

      // Navigate to Account Types via sidebar
      await page.getByRole('link', { name: /Account Types/i }).click();
      await expect(page.getByRole('heading', { name: /Account Types/i })).toBeVisible({ timeout: 10000 });

      // Navigate back to Dashboard via sidebar
      await page.getByRole('link', { name: /Dashboard/i }).click();
      await expect(page.getByRole('heading', { name: /Admin Dashboard/i })).toBeVisible({ timeout: 10000 });
    });
  });
});
