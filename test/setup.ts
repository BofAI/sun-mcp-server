// Global test setup file
import { TextDecoder, TextEncoder } from 'util';

// Add global TextEncoder/TextDecoder for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Setup for async tests
jest.setTimeout(30000); // 30 second timeout for async tests

// Silence console logs during tests unless explicitly enabled
if (!process.env.DEBUG_TESTS) {
  global.console.error = jest.fn();
  global.console.info = jest.fn();
  // Keep errors and warnings visible for debugging
  // global.console.warn = jest.fn();
  // global.console.error = jest.fn();
}

// Clean up after tests
afterAll(async () => {
  // Any global cleanup can be done here
});
