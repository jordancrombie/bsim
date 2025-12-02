/**
 * Admin E2E Test Helpers
 *
 * These helpers manage test admin users and invites for E2E testing
 * of the admin portal and auth server.
 *
 * Uses the test admin endpoints protected by X-Test-Admin-Key header.
 * Only works with @testadmin.banksim.ca email domain.
 */

/**
 * Test admin user data
 */
export interface TestAdmin {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Test invite response from the API
 */
export interface TestInviteResponse {
  code: string;
  email: string;
  role: string;
  expiresAt: string;
  existing?: boolean;
}

/**
 * Get the admin URL based on the base URL environment
 *
 * Local development and dev environment use admin-dev.banksim.ca
 * (local DNS resolves to local nginx, AWS DNS resolves to dev server)
 *
 * Production uses admin.banksim.ca
 */
export function getAdminUrl(): string {
  const baseURL = process.env.BASE_URL || 'https://dev.banksim.ca';

  if (baseURL.includes('localhost') || baseURL.includes('dev.banksim.ca')) {
    // Local dev and dev environment use admin-dev subdomain
    return 'https://admin-dev.banksim.ca';
  } else if (baseURL.includes('banksim.ca')) {
    // Production uses admin subdomain
    return 'https://admin.banksim.ca';
  }
  return 'https://admin-dev.banksim.ca';
}

/**
 * Generate a unique test admin email address
 * Format: test-admin-{timestamp}-{random}@testadmin.banksim.ca
 */
export function generateTestAdminEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-admin-${timestamp}-${random}@testadmin.banksim.ca`;
}

/**
 * Create a test admin user data object
 */
export function createTestAdmin(overrides?: Partial<TestAdmin>): TestAdmin {
  return {
    email: generateTestAdminEmail(),
    firstName: 'Test',
    lastName: 'Admin',
    ...overrides,
  };
}

/**
 * Create a test admin invite via the test API endpoint.
 *
 * @param email - Email address for the invite (must be @testadmin.banksim.ca)
 * @returns Invite code and details
 * @throws Error if invite creation fails
 *
 * @example
 * ```typescript
 * const admin = createTestAdmin();
 * const invite = await createTestAdminInvite(admin.email);
 * console.log(`Invite code: ${invite.code}`);
 * ```
 */
export async function createTestAdminInvite(email: string): Promise<TestInviteResponse> {
  const adminUrl = getAdminUrl();
  const testAdminKey = process.env.TEST_ADMIN_KEY || 'bsim-test-admin-secret-key';

  const response = await fetch(`${adminUrl}/api/test/admin-invites`, {
    method: 'POST',
    headers: {
      'X-Test-Admin-Key': testAdminKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create test admin invite: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Clean up all test admin users.
 * Deletes all admins with @testadmin.banksim.ca email.
 *
 * @returns Cleanup result with count of deleted admins
 */
export async function cleanupTestAdmins(): Promise<{ deletedCount: number; deletedEmails: string[] }> {
  const adminUrl = getAdminUrl();
  const testAdminKey = process.env.TEST_ADMIN_KEY || 'bsim-test-admin-secret-key';

  const response = await fetch(`${adminUrl}/api/test/admins`, {
    method: 'DELETE',
    headers: {
      'X-Test-Admin-Key': testAdminKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to cleanup test admins: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Clean up all test admin invites.
 * Deletes all invites for @testadmin.banksim.ca emails.
 *
 * @returns Cleanup result with count of deleted invites
 */
export async function cleanupTestAdminInvites(): Promise<{ deletedCount: number; deletedEmails: string[] }> {
  const adminUrl = getAdminUrl();
  const testAdminKey = process.env.TEST_ADMIN_KEY || 'bsim-test-admin-secret-key';

  const response = await fetch(`${adminUrl}/api/test/admin-invites`, {
    method: 'DELETE',
    headers: {
      'X-Test-Admin-Key': testAdminKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to cleanup test invites: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Get count of test admin users.
 *
 * @returns Count of test admins
 */
export async function getTestAdminCount(): Promise<number> {
  const adminUrl = getAdminUrl();
  const testAdminKey = process.env.TEST_ADMIN_KEY || 'bsim-test-admin-secret-key';

  const response = await fetch(`${adminUrl}/api/test/admins`, {
    method: 'GET',
    headers: {
      'X-Test-Admin-Key': testAdminKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get test admin count: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.count;
}

/**
 * Admin page URLs for navigation
 */
export const ADMIN_PAGES = {
  login: '/login',
  invite: '/invite',
  setup: '/setup',
  dashboard: '/',
  users: '/users',
  admins: '/admins',
  accountTypes: '/account-types',
  cardTypes: '/card-types',
  settings: '/settings',
} as const;
