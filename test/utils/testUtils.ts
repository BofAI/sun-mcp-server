import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Create a simple mock transport for testing instead of using SDK's transport
import { getProcessedOpenApi } from '../../src/openapiProcessor';
import { mapOpenApiToMcpTools } from '../../src/mcpMapper';
import { executeApiCall } from '../../src/apiClient';
import path from 'path';
import type { MappedTool } from '../../src/types';
import { testConfig } from '../fixtures/test-config';
import type { SpecConfig } from '../../src/config';

// Mock for the API client to return test responses instead of making actual HTTP calls
jest.mock('../../src/apiClient', () => ({
  executeApiCall: jest.fn().mockImplementation(async (apiCallDetails, input) => {
    const method = apiCallDetails.method;
    const pathTemplate = apiCallDetails.pathTemplate;

    if (method === 'GET' && pathTemplate === '/pets') {
      return {
        success: true,
        data: testConfig.mockResponses.listPets,
        statusCode: 200,
      };
    } else if (method === 'GET' && pathTemplate === '/pets/{petId}') {
      return {
        success: true,
        data: testConfig.mockResponses.getPetById,
        statusCode: 200,
      };
    } else if (method === 'POST' && pathTemplate === '/pets') {
      return {
        success: true,
        data: testConfig.mockResponses.createPet,
        statusCode: 201,
      };
    } else {
      return {
        success: false,
        error: `Operation not supported in tests: ${method} ${pathTemplate}`,
        statusCode: 400,
      };
    }
  }),
}));

// Extended McpServer interface for our testing needs
interface TestMcpServer extends McpServer {
  tools?: Record<string, Function>;
}

// Mock TestTransport class for MCP server
class MockTestTransport {
  private tools: Record<string, Function> = {};
  private server: TestMcpServer | null = null;
  
  async connect(server: TestMcpServer) {
    this.server = server;
    // Store references to all registered tools
    if (server.tools) {
      for (const [name, handler] of Object.entries(server.tools)) {
        if (typeof handler === 'function') {
          this.tools[name] = handler;
        }
      }
    }
    return Promise.resolve();
  }
  
  // Method to invoke a tool by name
  async callTool(toolName: string, params: any) {
    if (!this.tools[toolName]) {
      return {
        error: {
          code: 'tool_not_found',
          message: `Tool '${toolName}' not found`
        }
      };
    }
    
    try {
      // Create a mock extra object similar to what MCP would provide
      const extra = {
        params,
        request: { id: 'test-request-id' }
      };
      
      // Call the tool handler
      return await this.tools[toolName](extra);
    } catch (error: any) {
      return {
        error: {
          code: error.code || 'tool_error',
          message: error.message || 'Unknown error'
        }
      };
    }
  }
}

const TEST_SPEC_CONFIG: SpecConfig = {
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

/**
 * Create and set up an MCP server for testing
 */
export async function setupTestMcpServer() {
  // Process the OpenAPI spec
  const openapiSpec = await getProcessedOpenApi(TEST_SPEC_CONFIG);
  
  // Map OpenAPI operations to MCP tools
  const mappedTools = mapOpenApiToMcpTools(openapiSpec, {
    targetApiBaseUrl: testConfig.baseUrl,
    filter: TEST_SPEC_CONFIG.filter,
  });
  
  // Create a server instance
  const server = new McpServer({
    name: "Test OpenAPI to MCP Server",
    version: "1.0.0"
  }) as TestMcpServer;

  // Manually add tools property to server for test access
  server.tools = {};

  // Register the mapped tools
  for (const tool of mappedTools) {
    const { mcpToolDefinition, apiCallDetails } = tool;
    
    // Store the handler function in the tools object for direct access in tests
    const handler = async (extra: any) => {
      const input = extra.params;
      const result = await executeApiCall(apiCallDetails, input);
      
      if (result.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result.data, null, 2)
          }]
        };
      } else {
        throw new Error(result.error || `API Error ${result.statusCode}`);
      }
    };
    
    // Add to tools map for testing
    if (server.tools) {
      server.tools[mcpToolDefinition.name] = handler;
    }
    
    // Register with server
    server.tool(
      mcpToolDefinition.name,
      mcpToolDefinition.description,
      handler
    );
  }

  // Use our mock transport for testing
  const transport = new MockTestTransport();
  await transport.connect(server);

  return { server, transport, mappedTools };
}

/**
 * Clean up resources after testing
 */
export async function teardownTestMcpServer(server: TestMcpServer, transport: MockTestTransport) {
  try {
    await server.close();
  } catch (error) {
    console.error('Error closing server:', error);
  }
}

/**
 * Invoke an MCP tool for testing
 */
export async function invokeToolForTest(transport: MockTestTransport, toolName: string, params: any) {
  return await transport.callTool(toolName, params);
}
