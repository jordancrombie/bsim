// Jest setup for admin module testing

// Mock environment variables
process.env.ADMIN_JWT_SECRET = 'test-admin-secret-for-jest';
process.env.ADMIN_RP_ID = 'localhost';
process.env.ADMIN_ORIGIN = 'https://localhost';

// Increase timeout for async operations
jest.setTimeout(10000);

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
