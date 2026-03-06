// Mock implementation of the API client
export const executeApiCall = jest.fn();

// Set up default successful response
executeApiCall.mockImplementation(async (apiCallDetails: any, params: any) => {
  // Return a successful response by default
  return {
    success: true,
    statusCode: 200,
    data: { id: 1, name: 'Test Pet', tag: 'dog' },
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  };
});

// Helper to configure for error responses
export function mockApiError(statusCode = 404, errorData = { error: 'Not found' }) {
  executeApiCall.mockImplementationOnce(async () => ({
    success: false,
    statusCode,
    data: errorData,
    error: 'API Error',
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }));
}

// Helper to reset the mock
export function resetApiMock() {
  executeApiCall.mockClear();
}
