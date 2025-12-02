/**
 * Playwright Global Teardown
 *
 * This file runs after all tests have completed.
 * It cleans up test users created during E2E test runs.
 */

async function globalTeardown() {
  const baseURL = process.env.BASE_URL || 'https://dev.banksim.ca';
  const cleanupKey = process.env.TEST_CLEANUP_KEY || 'bsim-test-cleanup-secret-key';

  // Determine the API URL based on the base URL
  // For production (banksim.ca), backend is at the same domain under /api
  // For dev (dev.banksim.ca), same pattern
  const apiURL = `${baseURL}/api`;

  console.log(`\n[Teardown] Cleaning up test users from ${baseURL}...`);

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

    if (result.deletedEmails && result.deletedEmails.length > 0) {
      console.log(`[Teardown] Deleted users: ${result.deletedEmails.join(', ')}`);
    }
  } catch (error) {
    console.error('[Teardown] Error during cleanup:', error);
  }
}

export default globalTeardown;
