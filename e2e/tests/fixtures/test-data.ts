/**
 * Test data fixtures for BSIM E2E tests
 *
 * Uses @testuser.banksim.ca domain for all test emails.
 * Each test run generates unique emails using timestamps to avoid conflicts.
 */

/**
 * Generate a unique test email address
 * Format: test-{timestamp}-{random}@testuser.banksim.ca
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@testuser.banksim.ca`;
}

/**
 * Canned test user data for signup tests
 */
export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dateOfBirth?: string;
}

/**
 * Create a new test user with unique email
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: generateTestEmail(),
    password: 'TestPassword123!',
    phone: '416-555-0123',
    address: '123 Test Street',
    city: 'Toronto',
    state: 'ON',
    postalCode: 'M5V 1A1',
    dateOfBirth: '1990-01-15',
    ...overrides,
  };
}

/**
 * Canadian provinces for dropdown selection
 */
export const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
] as const;

/**
 * Sample test users for specific scenarios
 */
export const TEST_USERS = {
  // Standard test user with full profile
  standard: () => createTestUser({
    firstName: 'Jane',
    lastName: 'Doe',
  }),

  // Minimal test user (only required fields)
  minimal: () => createTestUser({
    firstName: 'Min',
    lastName: 'User',
    phone: undefined,
    address: undefined,
    city: undefined,
    state: undefined,
    postalCode: undefined,
    dateOfBirth: undefined,
  }),

  // User from different province
  vancouver: () => createTestUser({
    firstName: 'Van',
    lastName: 'Couver',
    city: 'Vancouver',
    state: 'BC',
    postalCode: 'V6B 1A1',
  }),
};

/**
 * Page URLs for navigation
 */
export const PAGES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
  accounts: '/dashboard/accounts',
  creditCards: '/dashboard/credit-cards',
  transfer: '/dashboard/transfer',
} as const;

/**
 * Test timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  // Short timeout for quick operations
  short: 5000,
  // Standard timeout for page loads
  standard: 10000,
  // Long timeout for operations that may take time (signup, etc.)
  long: 30000,
} as const;
