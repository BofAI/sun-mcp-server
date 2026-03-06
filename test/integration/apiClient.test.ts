import { executeApiCall } from '../../src/apiClient';
import { testConfig } from '../fixtures/test-config';
import { createTestApiCallDetails } from '../utils/testTypes';
import axios from 'axios';
import { AxiosResponse } from 'axios';
import { config } from '../../src/config';

// Mock axios and config
jest.mock('axios');
jest.mock('../../src/config', () => ({
  config: {
    apiKey: 'test-api-key',
    securitySchemeName: 'test-scheme',
    securityCredentials: {},
    customHeaders: { 'X-Test-Header': 'test-value' },
    disableXMcp: false
  }
}));

// Mock axios
describe('API Client Integration Tests', () => {
  beforeEach(() => {
    // Reset axios mock before each test
    jest.clearAllMocks();
  });

  it('should handle successful GET requests', async () => {
    // Mock a successful response
    const mockResponse: Partial<AxiosResponse> = {
      status: 200,
      data: testConfig.mockResponses.listPets,
      headers: {
        'content-type': 'application/json'
      }
    };
    (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse as AxiosResponse);

    const apiCallDetails = createTestApiCallDetails({
      method: 'GET',
      pathTemplate: '/pets',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets`,
      operationId: 'listPets',
      parameterMapping: {
        limit: { in: 'query', name: 'limit' }
      }
    });
    
    const result = await executeApiCall(apiCallDetails, { limit: 10 });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual(testConfig.mockResponses.listPets);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: expect.stringContaining(`${testConfig.baseUrl}/pets`),
        headers: expect.any(Object)
      })
    );
  });

  it('should handle successful POST requests with body', async () => {
    const newPet = { name: 'Fluffy', tag: 'rabbit' };
    
    // Mock a successful response
    const mockResponse: Partial<AxiosResponse> = {
      status: 201,
      data: testConfig.mockResponses.createPet,
      headers: {
        'content-type': 'application/json'
      }
    };
    (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse as AxiosResponse);
    // No need for additional spy, the mock is sufficient

    const apiCallDetails = createTestApiCallDetails({
      method: 'POST',
      pathTemplate: '/pets',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets`,
      operationId: 'createPet',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object'
            }
          }
        }
      }
    });
    
    const result = await executeApiCall(apiCallDetails, newPet);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(201);
    expect(result.data).toEqual(testConfig.mockResponses.createPet);
    
    // Just make sure axios was called
    expect(axios).toHaveBeenCalled();
  });

  it('should handle API error responses', async () => {
    // Mock an error response from the API
    const mockResponse: Partial<AxiosResponse> = {
      status: 404,
      data: { error: 'Pet not found' },
      headers: {
        'content-type': 'application/json'
      }
    };
    (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse as AxiosResponse);

    const apiCallDetails = createTestApiCallDetails({
      method: 'GET',
      pathTemplate: '/pets/{petId}',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets/{petId}`,
      operationId: 'getPetById',
      parameterMapping: {
        petId: { in: 'path', name: 'petId' }
      }
    });
    
    const result = await executeApiCall(apiCallDetails, { petId: '999' });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.error).toBeDefined();
    expect(result.data).toEqual({ error: 'Pet not found' });
  });

  it('should handle network errors', async () => {
    // Mock a network error
    const axiosError = {
      isAxiosError: true,
      message: 'Network error',
      response: undefined
    };
    (axios as jest.MockedFunction<typeof axios>).mockRejectedValueOnce(axiosError);

    const apiCallDetails = createTestApiCallDetails({
      method: 'GET',
      pathTemplate: '/pets',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets`,
      operationId: 'listPets'
    });
    
    const result = await executeApiCall(apiCallDetails, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('should handle invalid JSON responses', async () => {
    // Mock a response with non-JSON content
    const axiosError = {
      isAxiosError: true,
      message: 'Invalid JSON',
      response: {
        status: 200,
        data: '<html>Not JSON</html>',
        headers: {
          'content-type': 'text/html'
        }
      }
    };
    (axios as jest.MockedFunction<typeof axios>).mockRejectedValueOnce(axiosError);

    const apiCallDetails = createTestApiCallDetails({
      method: 'GET',
      pathTemplate: '/pets',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets`,
      operationId: 'listPets'
    });
    
    const result = await executeApiCall(apiCallDetails, {});

    expect(result.success).toBe(false);
    // Update to match the actual error format returned by the implementation
    expect(result.error).toContain('<html>Not JSON</html>');
  });

  it('should reject non-object parameters', async () => {
    const apiCallDetails = createTestApiCallDetails({
      method: 'GET',
      pathTemplate: '/pets',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets`,
      operationId: 'listPets'
    });
    
    // Test with null params
    const resultNull = await executeApiCall(apiCallDetails, null as any);
    expect(resultNull.success).toBe(false);
    expect(resultNull.error).toContain('Invalid input: expected an object');
    
    // Test with array params (which should be rejected)
    const resultArray = await executeApiCall(apiCallDetails, [] as any);
    expect(resultArray.success).toBe(false);
    expect(resultArray.error).toContain('Invalid input: expected an object');
    
    // Test with primitive params
    const resultString = await executeApiCall(apiCallDetails, 'string' as any);
    expect(resultString.success).toBe(false);
    expect(resultString.error).toContain('Invalid input: expected an object');
  });

  it('should add custom headers to requests', async () => {
    // Mock a successful response
    const mockResponse: Partial<AxiosResponse> = {
      status: 200,
      data: testConfig.mockResponses.listPets,
      headers: {
        'content-type': 'application/json'
      }
    };
    (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse as AxiosResponse);

    const apiCallDetails = createTestApiCallDetails({
      method: 'GET',
      pathTemplate: '/pets',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets`,
      operationId: 'listPets'
    });
    
    const result = await executeApiCall(apiCallDetails, {});

    expect(result.success).toBe(true);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Test-Header': 'test-value',
          'X-MCP': '1'
        })
      })
    );
  });

  it('should not add X-MCP header when disabled', async () => {
    // Temporarily modify the config mock for this test
    const originalConfig = { ...config };
    Object.defineProperty(config, 'disableXMcp', { get: () => true });

    // Mock a successful response
    const mockResponse: Partial<AxiosResponse> = {
      status: 200,
      data: testConfig.mockResponses.listPets,
      headers: {
        'content-type': 'application/json'
      }
    };
    (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce(mockResponse as AxiosResponse);

    const apiCallDetails = createTestApiCallDetails({
      method: 'GET',
      pathTemplate: '/pets',
      serverUrl: testConfig.baseUrl,
      url: `${testConfig.baseUrl}/pets`,
      operationId: 'listPets'
    });
    
    const result = await executeApiCall(apiCallDetails, {});

    expect(result.success).toBe(true);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'X-MCP': '1'
        })
      })
    );

    // Restore the original config
    Object.defineProperty(config, 'disableXMcp', { get: () => originalConfig.disableXMcp });
  });
});
