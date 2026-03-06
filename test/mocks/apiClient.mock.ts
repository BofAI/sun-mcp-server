// Mock implementation of the API client
export const executeApiCall = jest.fn();

executeApiCall.mockImplementation(async () => ({
  success: true,
  statusCode: 200,
  data: { code: 0, msg: 'success', data: {} },
  headers: new Headers({
    'Content-Type': 'application/json',
  }),
}));

export function mockApiError(statusCode = 404, errorData = { error: 'Not found' }) {
  executeApiCall.mockImplementationOnce(async () => ({
    success: false,
    statusCode,
    data: errorData,
    error: 'API Error',
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  }));
}

export function resetApiMock() {
  executeApiCall.mockClear();
}
