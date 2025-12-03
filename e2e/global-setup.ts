/**
 * Playwright Global Setup
 *
 * This file runs before all tests start.
 * It cleans up any leftover test users from previous runs.
 */

/**
 * Get the admin URL based on the base URL
 */
function getAdminUrl(baseURL: string): string {
  if (baseURL.includes('localhost')) {
    return 'https://admin-dev.banksim.ca';
  } else if (baseURL.includes('dev.banksim.ca')) {
    return 'https://admin-dev.banksim.ca';
  } else if (baseURL.includes('banksim.ca')) {
    return 'https://admin.banksim.ca';
  }
  return 'https://admin-dev.banksim.ca';
}

async function cleanupTestUsers(baseURL: string, cleanupKey: string) {
  const apiURL = `${baseURL}/api`;

  console.log(`[Setup] Cleaning up leftover test users from ${baseURL}...`);

  try {
    const response = await fetch(`${apiURL}/test-cleanup/users`, {
      method: 'DELETE',
      headers: {
        'X-Test-Cleanup-Key': cleanupKey,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[Setup] ${result.message}`);
    } else if (response.status !== 404) {
      console.log(`[Setup] Test user cleanup endpoint not available (${response.status})`);
    }
  } catch (error) {
    console.log('[Setup] Test user cleanup skipped (endpoint may not be configured)');
  }
}

async function cleanupTestAdmins(adminURL: string, testAdminKey: string) {
  console.log(`[Setup] Cleaning up leftover test admins from ${adminURL}...`);

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
      console.log(`[Setup] ${result.message}`);
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
      console.log(`[Setup] ${result.message}`);
    }
  } catch (error) {
    console.log('[Setup] Admin cleanup skipped (endpoint may not be configured)');
  }
}

async function globalSetup() {
  const baseURL = process.env.BASE_URL || 'https://dev.banksim.ca';
  const cleanupKey = process.env.TEST_CLEANUP_KEY || 'bsim-test-cleanup-secret-key';
  const testAdminKey = process.env.TEST_ADMIN_KEY || 'bsim-test-admin-secret-key';

  console.log('\n[Setup] Starting E2E test pre-cleanup...');

  // Clean up test users from previous runs
  await cleanupTestUsers(baseURL, cleanupKey);

  // Clean up test admins from previous runs
  const adminURL = getAdminUrl(baseURL);
  await cleanupTestAdmins(adminURL, testAdminKey);

  console.log('[Setup] Pre-cleanup complete.\n');
}

export default globalSetup;
