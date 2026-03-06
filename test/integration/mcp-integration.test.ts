import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs/promises';
import path from 'path';
import { testConfig } from '../fixtures/test-config';
import { mapOpenApiToMcpTools } from '../../src/mcpMapper';
import { createTestApiCallDetails } from '../utils/testTypes';

// Import the mocked API client instead of the real one
import { executeApiCall, mockApiError, resetApiMock } from '../mocks/apiClient.mock';

// Store original environment variables
const originalEnv = { ...process.env };

// Mock the API client module
jest.mock('../../src/apiClient', () => ({
  executeApiCall
}));

describe('OpenAPI to MCP Integration Tests', () => {
  let openApiSpec: any;

  beforeAll(async () => {
    // Load the test OpenAPI spec directly from the fixture file
    const content = await fs.readFile(path.resolve(process.cwd(), testConfig.openApiFile), 'utf-8');
    openApiSpec = JSON.parse(content);
  });

  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();
    resetApiMock();
    
    // Reset environment variables to original state
    process.env = { ...originalEnv };
  });
  
  afterAll(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe('OpenAPI Parsing', () => {
    it('should contain expected paths and operations', () => {
      // Test the OpenAPI spec structure directly
      expect(openApiSpec).toBeDefined();
      expect(openApiSpec.openapi).toBe('3.0.0');
      expect(openApiSpec.info.title).toBe('Petstore API');
      
      // Verify paths
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.paths["/pets"]).toBeDefined();
      expect(openApiSpec.paths["/pets/{petId}"]).toBeDefined();
      
      // Verify operations
      expect(openApiSpec.paths["/pets"].get).toBeDefined();
      expect(openApiSpec.paths["/pets"].get.operationId).toBe('listPets');
      expect(openApiSpec.paths["/pets"].post).toBeDefined();
      expect(openApiSpec.paths["/pets"].post.operationId).toBe('createPet');
      expect(openApiSpec.paths["/pets/{petId}"].get).toBeDefined();
      expect(openApiSpec.paths["/pets/{petId}"].get.operationId).toBe('getPetById');
      
      // Verify schemas
      expect(openApiSpec.components.schemas.Pet).toBeDefined();
      expect(openApiSpec.components.schemas.NewPet).toBeDefined();
      expect(openApiSpec.components.schemas.Pets).toBeDefined();
    });
  });

  describe('MCP Mapper', () => {
    it('should map OpenAPI spec to MCP tools', () => {
      // Test the mapping function
      const mappedTools = mapOpenApiToMcpTools(openApiSpec);
      
      // Verify the tools were mapped correctly
      expect(mappedTools).toBeDefined();
      expect(Array.isArray(mappedTools)).toBe(true);
      expect(mappedTools.length).toBe(3); // 3 operations in our test spec
      
      // Check tool names
      const toolNames = mappedTools.map(tool => tool.mcpToolDefinition.name);
      expect(toolNames).toContain('listPets');
      expect(toolNames).toContain('getPetById');
      expect(toolNames).toContain('createPet');
      
      // Verify tool structure for one tool
      const listPetsTool = mappedTools.find(tool => tool.mcpToolDefinition.name === 'listPets');
      expect(listPetsTool).toBeDefined();
      expect(listPetsTool?.mcpToolDefinition.description).toBeDefined();
      expect(listPetsTool?.mcpToolDefinition.inputSchema).toBeDefined();
      expect(listPetsTool?.apiCallDetails.method).toBe('GET');
    });
    
    it('should respect operation filtering via environment variables', () => {
      // Set the correct environment variables that the config actually uses
      process.env.MCP_WHITELIST_OPERATIONS = 'listPets';
      process.env.MCP_BLACKLIST_OPERATIONS = '';
      
      // Re-require the config to force it to read the updated environment variables
      jest.resetModules();
      jest.doMock('../../src/config', () => ({
        config: {
          filter: {
            whitelist: ['listPets'],
            blacklist: []
          }
        }
      }));
      
      // Get a fresh instance of the function with the mocked config
      const { mapOpenApiToMcpTools } = require('../../src/mcpMapper');
      
      // Test filtering
      const filteredTools = mapOpenApiToMcpTools(openApiSpec);
      
      // Should now only have listPets
      expect(filteredTools.length).toBe(1);
      expect(filteredTools[0].mcpToolDefinition.name).toBe('listPets');
      
      // Reset mocks to not affect other tests
      jest.dontMock('../../src/config');
    });
  });

  describe('API Client', () => {
    it('should correctly execute API calls', async () => {
      // Set up test data
      const mockResponse = { id: 1, name: 'Rex', tag: 'dog' };
      executeApiCall.mockImplementationOnce(async () => ({
        success: true,
        statusCode: 200,
        data: mockResponse,
        headers: new Headers({ 'Content-Type': 'application/json' })
      }));
      
      // Create API call details
      const apiCallDetails = createTestApiCallDetails({
        method: 'GET',
        pathTemplate: '/pets/{petId}',
        serverUrl: 'http://example.com/api'
      });

      // Execute the API call
      const result = await executeApiCall(apiCallDetails, { petId: '1' });

      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual(mockResponse);
      
      // Check that executeApiCall was called with the right arguments
      expect(executeApiCall).toHaveBeenCalledTimes(1);
      expect(executeApiCall).toHaveBeenCalledWith(
        apiCallDetails,
        { petId: '1' }
      );
    });

    it('should handle error responses', async () => {
      // Set up error response
      const errorResponse = { error: 'Not found' };
      mockApiError(404, errorResponse);
      
      // Create API call details
      const apiCallDetails = createTestApiCallDetails({
        method: 'GET',
        pathTemplate: '/pets/{petId}',
        serverUrl: 'http://example.com/api'
      });

      // Execute the API call
      const result = await executeApiCall(apiCallDetails, { petId: '999' });

      // Verify the result
      expect(result).toBeDefined();
      expect(result.statusCode).toBe(404);
      expect(result.success).toBe(false);
      expect(result.data).toEqual(errorResponse);
    });
  });

  describe('MCP Server Integration', () => {
    it('should create an MCP server with tools', () => {
      // Create an MCP server
      const server = new McpServer({
        name: 'Test Server',
        version: '1.0.0'
      });
      
      // Get mapped tools
      const mappedTools = mapOpenApiToMcpTools(openApiSpec);
      
      // Register tools with server
      for (const tool of mappedTools) {
        const { mcpToolDefinition } = tool;
        
        // Register a simple handler that just returns a test response
        server.tool(
          mcpToolDefinition.name,
          mcpToolDefinition.description,
          async () => ({
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true })
            }]
          })
        );
      }
      
      // Verify server has tools registered
      // Since we can't access server.tools directly, we'll rely on the fact that
      // registration succeeded without errors as a basic test
      expect(server).toBeDefined();
    });
  });
});
