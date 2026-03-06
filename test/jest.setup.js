// This file contains setup code that will run before all tests

// Mock console methods to reduce noise during tests unless in debug mode
if (!process.env.DEBUG_TESTS) {
  global.console.error = jest.fn();
  global.console.info = jest.fn();
  // Keep warnings and errors for debugging
}

// Set test environment variables
process.env.NODE_ENV = 'test';

// Create global mock objects as needed
global.fetch = jest.fn();

// Extended Jest matchers or utilities if needed
expect.extend({
  toBeValidUrl: (received) => {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false
      };
    }
  }
});

// Clean up after all tests
afterAll(() => {
  jest.clearAllMocks();
});
