import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for BSIM E2E tests
 *
 * Usage:
 *   npm test              - Run all tests against local dev
 *   npm run test:headed   - Run with browser visible
 *   npm run test:prod     - Run against production (banksim.ca)
 *   npm run test:ui       - Run with Playwright UI mode
 */

// Default to local dev environment, can override with BASE_URL env var
const baseURL = process.env.BASE_URL || 'https://dev.banksim.ca';

export default defineConfig({
  testDir: './tests',

  // Global setup to clean up leftover test users before tests run
  globalSetup: './global-setup.ts',

  // Global teardown to clean up test users after all tests
  globalTeardown: './global-teardown.ts',

  // Run test files in parallel, but tests within a file run sequentially.
  // This prevents race conditions in beforeAll hooks that create shared test users.
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI (can be flaky with shared test data)
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Ignore HTTPS errors (for self-signed certs in dev)
    ignoreHTTPSErrors: true,

    // Timeout for each action (click, fill, etc.)
    actionTimeout: 10000,
  },

  // Global timeout for each test
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results/',
});
