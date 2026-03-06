// Test configuration file
export const testConfig = {
  openApiFile: 'test/fixtures/petstore-openapi.json',
  baseUrl: 'http://localhost:3000/api',
  tools: {
    // Optional tool configuration/filtering for tests
    includeOperationIds: ['listPets', 'getPetById', 'createPet'],
    excludeOperationIds: [],
  },
  server: {
    port: 9000, // Use a different port for testing
    host: 'localhost',
  },
  // Custom request headers for testing
  headers: {
    'X-Test-Header': 'test-value',
    'X-API-Version': '1.0.0'
  },
  // Flag to control X-MCP header for testing
  disableXMcp: false,
  // Mock responses for API calls during tests
  mockResponses: {
    listPets: [
      { id: 1, name: 'Rex', tag: 'dog' },
      { id: 2, name: 'Whiskers', tag: 'cat' },
    ],
    getPetById: { id: 1, name: 'Rex', tag: 'dog' },
    createPet: { id: 3, name: 'Fluffy', tag: 'rabbit' },
  },
};
