/**
 * Playwright Global Teardown
 *
 * This file runs after all tests have completed.
 * It cleans up test users and test admins created during E2E test runs.
 */

/**
 * Get the admin URL based on the base URL
 * - https://banksim.ca -> https://admin.banksim.ca
 * - https://dev.banksim.ca -> https://admin-dev.banksim.ca
 * - https://localhost -> https://admin-dev.banksim.ca (local dev uses dev subdomains)
 */
function getAdminUrl(baseURL: string): string {
  if (baseURL.includes('localhost')) {
    // Local dev environment uses dev subdomains
    return 'https://admin-dev.banksim.ca';
  } else if (baseURL.includes('dev.banksim.ca')) {
    return 'https://admin-dev.banksim.ca';
  } else if (baseURL.includes('banksim.ca')) {
    return 'https://admin.banksim.ca';
  }
  // Fallback to dev
  return 'https://admin-dev.banksim.ca';
}

async function cleanupTestUsers(baseURL: string, cleanupKey: string) {
  const apiURL = `${baseURL}/api`;

  console.log(`[Teardown] Cleaning up test users from ${baseURL}...`);

  try {
    const response = await fetch(`${apiURL}/test-cleanup/users`, {
      method: 'DELETE',
      headers: {
        'X-Test-Cleanup-Key': cleanupKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Teardown] Failed to clean up test users: ${response.status} ${response.statusText}`);
      console.error(`[Teardown] Response: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(`[Teardown] ${result.message}`);

    if (result.deletedEmails && result.deletedEmails.length > 0 && result.deletedEmails.length <= 10) {
      console.log(`[Teardown] Deleted users: ${result.deletedEmails.join(', ')}`);
    }
  } catch (error) {
    console.error('[Teardown] Error during test user cleanup:', error);
  }
}

async function cleanupTestAdmins(adminURL: string, testAdminKey: string) {
  console.log(`[Teardown] Cleaning up test admins from ${adminURL}...`);

  try {
    // Clean up test admin users
    const adminsResponse = await fetch(`${adminURL}/api/test/admins`, {
      method: 'DELETE',
      headers: {
        'X-Test-Admin-Key': testAdminKey,
        'Content-Type': 'application/json',
      },
    });

    if (adminsResponse.ok) {
      const result = await adminsResponse.json();
      console.log(`[Teardown] ${result.message}`);
    } else if (adminsResponse.status !== 503) {
      // 503 means endpoint not configured, which is fine for production
      console.error(`[Teardown] Failed to clean up test admins: ${adminsResponse.status}`);
    }

    // Clean up test admin invites
    const invitesResponse = await fetch(`${adminURL}/api/test/admin-invites`, {
      method: 'DELETE',
      headers: {
        'X-Test-Admin-Key': testAdminKey,
        'Content-Type': 'application/json',
      },
    });

    if (invitesResponse.ok) {
      const result = await invitesResponse.json();
      console.log(`[Teardown] ${result.message}`);
    } else if (invitesResponse.status !== 503) {
      console.error(`[Teardown] Failed to clean up test invites: ${invitesResponse.status}`);
    }
  } catch (error) {
    // Silently ignore errors for admin cleanup (may not be configured)
    console.log('[Teardown] Admin cleanup skipped (endpoint may not be configured)');
  }
}

async function globalTeardown() {
  const baseURL = process.env.BASE_URL || 'https://dev.banksim.ca';
  const cleanupKey = process.env.TEST_CLEANUP_KEY || 'bsim-test-cleanup-secret-key';
  const testAdminKey = process.env.TEST_ADMIN_KEY || 'bsim-test-admin-secret-key';

  console.log('\n[Teardown] Starting E2E test cleanup...');

  // Clean up test users (backend)
  await cleanupTestUsers(baseURL, cleanupKey);

  // Clean up test admins (admin server)
  const adminURL = getAdminUrl(baseURL);
  await cleanupTestAdmins(adminURL, testAdminKey);

  console.log('[Teardown] Cleanup complete.\n');
}

export default globalTeardown;
