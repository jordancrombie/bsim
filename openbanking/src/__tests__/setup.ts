// Jest setup for openbanking module tests

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
