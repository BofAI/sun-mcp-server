import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getProcessedOpenApi } from '../../src/openapiProcessor';
import { mapOpenApiToMcpTools } from '../../src/mcpMapper';
import { testConfig } from '../fixtures/test-config';
import { MappedTool } from '../../src/types';
import type { SpecConfig } from '../../src/config';
import path from 'path';

// Mock the API client to return test responses instead of making real HTTP calls
jest.mock('../../src/apiClient', () => ({
  executeApiCall: jest.fn().mockImplementation(async (apiCallDetails, input) => {
    // Determine which mock response to return based on the operation
    const operationId = apiCallDetails.operationId || '';
    
    if (operationId === 'listPets' || apiCallDetails.method === 'GET' && apiCallDetails.pathTemplate?.includes('/pets') && !apiCallDetails.pathTemplate?.includes('petId')) {
      return {
        success: true,
        data: testConfig.mockResponses.listPets,
        statusCode: 200,
        headers: new Headers({ 'Content-Type': 'application/json' })
      };
    } else if (operationId === 'getPetById' || apiCallDetails.pathTemplate?.includes('/pets/{petId}')) {
      return {
        success: true,
        data: testConfig.mockResponses.getPetById,
        statusCode: 200,
        headers: new Headers({ 'Content-Type': 'application/json' })
      };
    } else if (operationId === 'createPet' || (apiCallDetails.method === 'POST' && apiCallDetails.pathTemplate?.includes('/pets'))) {
      return {
        success: true,
        data: testConfig.mockResponses.createPet,
        statusCode: 201,
        headers: new Headers({ 'Content-Type': 'application/json' })
      };
    } else {
      return {
        success: false,
        error: `Operation not supported in tests: ${operationId}`,
        statusCode: 400,
        headers: new Headers({ 'Content-Type': 'application/json' })
      };
    }
  }),
}));

// Define interfaces for type safety
interface ExtraParams {
  params: Record<string, any>;
  [key: string]: any;
}

interface ToolCallResponseContent {
  type: string;
  text: string;
}

interface ToolCallResponse {
  content: ToolCallResponseContent[];
}

describe('MCP Tool Integration Tests with Direct Handler Calls', () => {
  let mcpServer: McpServer;
  let mappedTools: MappedTool[];
  let toolHandlers: Record<string, (extra: ExtraParams) => Promise<ToolCallResponse>>;
  const testSpecConfig: SpecConfig = {
    specPath: path.resolve(process.cwd(), testConfig.openApiFile),
    overlayPaths: [],
    targetApiBaseUrl: testConfig.baseUrl,
    requestTimeoutMs: 30000,
    customHeaders: {},
    disableXMcp: false,
    filter: {
      whitelist: null,
      blacklist: [],
    },
  };
  
  beforeAll(async () => {
    // Process OpenAPI spec
    const openapiSpec = await getProcessedOpenApi(testSpecConfig);
    mappedTools = mapOpenApiToMcpTools(openapiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    });
    
    // Create MCP server for registration only
    mcpServer = new McpServer({
      name: 'Test MCP Server',
      version: '1.0.0'
    });
    
    // Store tool handlers for direct testing
    toolHandlers = {};
    
    // Register tools with server and store handlers
    for (const tool of mappedTools) {
      const { mcpToolDefinition, apiCallDetails } = tool;
      
      // Define the handler function
      const handler = async (extra: ExtraParams): Promise<ToolCallResponse> => {
        try {
          // We're importing this dynamically to work with the Jest mock
          const { executeApiCall } = require('../../src/apiClient');
          const input = extra.params;
          const result = await executeApiCall(apiCallDetails, input);
          
          if (result.success) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result.data)
              }]
            };
          } else {
            throw new Error(result.error || `API Error ${result.statusCode}`);
          }
        } catch (error: any) {
          console.error(`Error handling tool call for ${mcpToolDefinition.name}:`, error);
          throw error;
        }
      };
      
      // Store handler for direct testing
      toolHandlers[mcpToolDefinition.name] = handler;
      
      // Register with server
      mcpServer.tool(
        mcpToolDefinition.name,
        mcpToolDefinition.description,
        handler
      );
    }
  });
  
  afterAll(async () => {
    // Clean up resources
    try {
      if (mcpServer) {
        await mcpServer.close();
      }
    } catch (error) {
      console.error('Error cleaning up test resources:', error);
    }
  });
  
  it('should have registered all expected tools', () => {
    // Verify tools were registered correctly
    const toolNames = Object.keys(toolHandlers);
    
    expect(toolNames.length).toBe(mappedTools.length);
    expect(toolNames).toContain('listPets');
    expect(toolNames).toContain('getPetById');
    expect(toolNames).toContain('createPet');
  });
  
  it('should successfully call the listPets tool handler directly', async () => {
    // Call the listPets handler directly
    const params = { limit: 10 };
    const handler = toolHandlers['listPets'];
    expect(handler).toBeDefined();
    
    const response = await handler({ params, request: { id: 'test-req-1' } });
    
    // Verify the response
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
    
    // Check content type and data
    const textContent = response.content[0];
    expect(textContent.type).toBe('text');
    
    // Parse and verify the data
    const pets = JSON.parse(textContent.text);
    expect(Array.isArray(pets)).toBe(true);
    expect(pets.length).toBe(testConfig.mockResponses.listPets.length);
    expect(pets[0].name).toBe(testConfig.mockResponses.listPets[0].name);
  });
  
  it('should successfully call the getPetById tool handler directly', async () => {
    // Call the getPetById handler directly
    const params = { petId: '1' };
    const handler = toolHandlers['getPetById'];
    expect(handler).toBeDefined();
    
    const response = await handler({ params, request: { id: 'test-req-2' } });
    
    // Verify the response
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    
    // Check content type and data
    const textContent = response.content[0];
    expect(textContent.type).toBe('text');
    
    // Parse and verify the data
    const pet = JSON.parse(textContent.text);
    expect(pet).toEqual(testConfig.mockResponses.getPetById);
    expect(pet.id).toBe(1);
    expect(pet.name).toBe('Rex');
  });
  
  it('should successfully call the createPet tool handler directly', async () => {
    // Call the createPet handler directly
    const params = { name: 'Fluffy', tag: 'rabbit' };
    const handler = toolHandlers['createPet'];
    expect(handler).toBeDefined();
    
    const response = await handler({ params, request: { id: 'test-req-3' } });
    
    // Verify the response
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    
    // Check content type and data
    const textContent = response.content[0];
    expect(textContent.type).toBe('text');
    
    // Parse and verify the data 
    const pet = JSON.parse(textContent.text);
    expect(pet).toEqual(testConfig.mockResponses.createPet);
    expect(pet.id).toBe(3);
    expect(pet.name).toBe('Fluffy');
    expect(pet.tag).toBe('rabbit');
  });
  
  it('should propagate errors from the API client through the handler', async () => {
    // Use a non-existent tool to force an error case
    const apiClient = require('../../src/apiClient');
    apiClient.executeApiCall.mockImplementationOnce(async () => ({
      success: false,
      error: 'Test error message',
      statusCode: 500,
      headers: new Headers({ 'Content-Type': 'application/json' })
    }));
    
    // Call handler with error-triggering parameters
    const handler = toolHandlers['listPets'];
    let error: Error | undefined;
    
    try {
      await handler({ params: { triggersError: true }, request: { id: 'test-req-4' } });
    } catch (err) {
      error = err as Error;
    }
    
    expect(error).toBeDefined();
    expect(error?.message).toContain('Test error message');
  });
});
