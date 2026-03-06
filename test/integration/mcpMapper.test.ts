import { mapOpenApiToMcpTools } from '../../src/mcpMapper';
import { getProcessedOpenApi } from '../../src/openapiProcessor';
import { testConfig } from '../fixtures/test-config';
import { TestMappedTool } from '../utils/testTypes';
import path from 'path';
import type { SpecConfig } from '../../src/config';

describe('MCP Mapper Integration Tests', () => {
  let openApiSpec: any;
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
    try {
      openApiSpec = await getProcessedOpenApi(testSpecConfig);
    } catch (error) {
      console.error('Error loading OpenAPI spec in beforeAll:', error);
      throw error;
    }
  });

  it('should map OpenAPI operations to MCP tools', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    
    expect(mappedTools).toBeDefined();
    expect(Array.isArray(mappedTools)).toBe(true);
    expect(mappedTools.length).toBe(3); // Based on our sample OpenAPI with 3 operations
    
    // Verify mapped tool structure
    for (const tool of mappedTools) {
      expect(tool).toHaveProperty('mcpToolDefinition');
      expect(tool).toHaveProperty('apiCallDetails');
      
      const { mcpToolDefinition, apiCallDetails } = tool;
      
      // Check MCP tool definition
      expect(mcpToolDefinition).toHaveProperty('name');
      expect(mcpToolDefinition).toHaveProperty('description');
      expect(mcpToolDefinition).toHaveProperty('inputSchema');
      
      // Check API call details
      expect(apiCallDetails).toHaveProperty('method');
      expect(apiCallDetails).toHaveProperty('pathTemplate');
      expect(apiCallDetails).toHaveProperty('serverUrl');
    }
  });

  it('should have consistent parameter mapping', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    
    // Get the getPetById tool for testing parameter mapping
    const getPetByIdTool = mappedTools.find(t => t.mcpToolDefinition.name === 'getPetById');
    
    expect(getPetByIdTool).toBeDefined();
    if (getPetByIdTool) {
      const { apiCallDetails, mcpToolDefinition } = getPetByIdTool;
      
      // Verify path parameter is correctly mapped
      expect(apiCallDetails.pathTemplate).toContain('{petId}');
      expect(mcpToolDefinition.inputSchema.properties).toHaveProperty('petId');
      
      // Check if the schema shows it as required
      expect(mcpToolDefinition.inputSchema.required).toContain('petId');

      // Verify parameter location metadata is correctly set
      expect(mcpToolDefinition.inputSchema.properties?.petId).toHaveProperty('x-parameter-location');
      expect((mcpToolDefinition.inputSchema.properties?.petId as any)['x-parameter-location']).toBe('path');
    }
  });

  it('should preserve format and type information', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    
    // Get the tool with parameters that have formats
    const listPetsTool = mappedTools.find(t => t.mcpToolDefinition.name === 'listPets');
    
    expect(listPetsTool).toBeDefined();
    if (listPetsTool) {
      const { mcpToolDefinition } = listPetsTool;
      
      // Assuming the 'limit' parameter has a format in the test fixture
      // This checks that format information is preserved
      const limitParam = mcpToolDefinition.inputSchema.properties?.limit;
      expect(limitParam).toBeDefined();
      if (limitParam) {
        // Check type is preserved
        expect(limitParam).toHaveProperty('type');
        // If the parameter has a format in the test data, check it's preserved
        if ((limitParam as any).format) {
          expect(limitParam).toHaveProperty('format');
        }
      }
    }
  });

  it('should include path summary in tool description if available', async () => {
    // First, we create a modified OpenAPI spec with a path summary
    const modifiedSpec = JSON.parse(JSON.stringify(openApiSpec)); // Deep clone
    
    // Add summary to path but not to operation
    if (modifiedSpec.paths && modifiedSpec.paths['/pets/{petId}']) {
      const pathItem = modifiedSpec.paths['/pets/{petId}'];
      const operation = pathItem.get;
      
      // Ensure operation doesn't have summary or description
      delete operation.summary;
      delete operation.description;
      
      // Add summary to the path item
      pathItem.summary = 'Test path summary';
    }
    
    // Map the modified spec to MCP tools
    const mappedTools = mapOpenApiToMcpTools(modifiedSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    
    // Find the getPetById tool
    const getPetByIdTool = mappedTools.find(t => t.mcpToolDefinition.name === 'getPetById');
    expect(getPetByIdTool).toBeDefined();
    
    if (getPetByIdTool) {
      // Verify the description includes the path summary
      expect(getPetByIdTool.mcpToolDefinition.description).toBe('Test path summary');
    }
  });

  it('should map request and response types correctly', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    
    // Check the createPet tool for request body mapping
    const createPetTool = mappedTools.find(t => t.mcpToolDefinition.name === 'createPet');
    
    expect(createPetTool).toBeDefined();
    if (createPetTool) {
      const { mcpToolDefinition } = createPetTool;
      
      // Verify request body mapping
      expect(mcpToolDefinition.inputSchema.properties).toBeDefined();
      
      // Check for requestBody property which should contain schema
      expect(mcpToolDefinition.inputSchema.properties?.requestBody).toBeDefined();
      
      // Check if content types are included
      expect((mcpToolDefinition.inputSchema.properties?.requestBody as any)['x-content-types']).toBeDefined();
    }
  });

  it('should correctly map GET operation with query parameters', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    const listPetsTool = mappedTools.find(tool => tool.mcpToolDefinition.name === 'listPets');
    
    expect(listPetsTool).toBeDefined();
    expect(listPetsTool?.mcpToolDefinition.name).toBe('listPets');
    expect(listPetsTool?.apiCallDetails.method).toBe('GET');

    if (listPetsTool) {
      // Verify query parameter location metadata
      const limitParam = listPetsTool.mcpToolDefinition.inputSchema.properties?.limit;
      if (limitParam) {
        expect((limitParam as any)['x-parameter-location']).toBe('query');
      }
    }
  });

  it('should correctly map GET operation with path parameters', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    const getPetByIdTool = mappedTools.find(tool => tool.mcpToolDefinition.name === 'getPetById');
    
    expect(getPetByIdTool).toBeDefined();
    expect(getPetByIdTool?.mcpToolDefinition.name).toBe('getPetById');
    expect(getPetByIdTool?.apiCallDetails.method).toBe('GET');
  });

  it('should correctly map POST operation with request body', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    const createPetTool = mappedTools.find(tool => tool.mcpToolDefinition.name === 'createPet');
    
    expect(createPetTool).toBeDefined();
    expect(createPetTool?.mcpToolDefinition.name).toBe('createPet');
    expect(createPetTool?.apiCallDetails.method).toBe('POST');
  });

  it('should filter operations based on whitelist with exact matches', async () => {
    const filteredTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: {
        whitelist: ['listPets', 'getPetById'],
        blacklist: [],
      },
    }) as TestMappedTool[];
    
    // Check only the expected tools are included
    const toolNames = filteredTools.map(t => t.mcpToolDefinition.name);
    expect(toolNames).toContain('listPets');
    expect(toolNames).toContain('getPetById');
    expect(toolNames).not.toContain('createPet'); // Should be filtered out
    
  });

  it('should filter operations based on blacklist with exact matches', async () => {
    const filteredTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: {
        whitelist: null,
        blacklist: ['createPet'],
      },
    }) as TestMappedTool[];
    
    // Check excluded tools are not present
    const filteredToolNames = filteredTools.map(t => t.mcpToolDefinition.name);
    expect(filteredToolNames).not.toContain('createPet');
    expect(filteredToolNames).toContain('listPets');
    expect(filteredToolNames).toContain('getPetById');
    
  });

  it('should filter operations using glob patterns for operationId', async () => {
    const filteredTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: {
        whitelist: ['get*'],
        blacklist: [],
      },
    }) as TestMappedTool[];
    
    // Check only tools matching the pattern are included
    const toolNames = filteredTools.map(t => t.mcpToolDefinition.name);
    expect(toolNames).toContain('getPetById'); // Should match 'get*'
    expect(toolNames).not.toContain('listPets'); // Shouldn't match 'get*'
    expect(toolNames).not.toContain('createPet'); // Shouldn't match 'get*'
    
  });

  it('should filter operations using glob patterns for URL paths', async () => {
    let filteredTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: {
        whitelist: ['GET:/pets/{petId}'],
        blacklist: [],
      },
    }) as TestMappedTool[];
    
    // Check only tools matching the URL pattern are included
    const toolNames = filteredTools.map(t => t.mcpToolDefinition.name);
    expect(toolNames).toContain('getPetById'); // Should match 'GET:/pets/{petId}'
    expect(toolNames).not.toContain('createPet'); // POST method, shouldn't match
    
    filteredTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: {
        whitelist: ['POST:/pets'],
        blacklist: [],
      },
    }) as TestMappedTool[];
    
    // Check only POST operations are included
    const postToolNames = filteredTools.map(t => t.mcpToolDefinition.name);
    expect(postToolNames).toContain('createPet'); // Should match 'POST:/pets'
    expect(postToolNames).not.toContain('getPetById'); // GET method, shouldn't match
    expect(postToolNames).not.toContain('listPets'); // GET method, shouldn't match
    
  });

  it('should preserve integer types for parameters', async () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    
    // Find the listPets tool which should have a limit parameter of type integer
    const listPetsTool = mappedTools.find(t => t.mcpToolDefinition.name === 'listPets');
    
    expect(listPetsTool).toBeDefined();
    
    if (listPetsTool) {
      const { mcpToolDefinition } = listPetsTool;
      
      // Check if limit parameter exists
      expect(mcpToolDefinition.inputSchema.properties).toHaveProperty('limit');
      
      // The crucial test: verify the limit parameter is of type integer, not string
      const limitParam = mcpToolDefinition.inputSchema.properties?.limit;
      
      // This should be 'integer', not 'string'
      expect(limitParam).toHaveProperty('type', 'integer');
      
      // Check format is preserved
      expect(limitParam).toHaveProperty('format', 'int32');
    }
  });

  it('should use custom x-mcp extension properties for tool name and description', async () => {
    // Create a modified OpenAPI spec with x-mcp extensions for testing
    const modifiedSpec = JSON.parse(JSON.stringify(openApiSpec)); // Deep clone
    
    // Add x-mcp extension at the operation level
    if (modifiedSpec.paths && modifiedSpec.paths['/pets'] && modifiedSpec.paths['/pets']['get']) {
      modifiedSpec.paths['/pets']['get']['x-mcp'] = {
        name: 'CustomListPets',
        description: 'Custom description for list pets endpoint from x-mcp extension'
      };
    }
    
    // Add x-mcp extension at the path level for a different path
    if (modifiedSpec.paths && modifiedSpec.paths['/pets/{petId}']) {
      modifiedSpec.paths['/pets/{petId}']['x-mcp'] = {
        name: 'CustomPetByIdAPI',
        description: 'Custom path-level description for pet by ID endpoint'
      };
    }
    
    const mappedTools = mapOpenApiToMcpTools(modifiedSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    }) as TestMappedTool[];
    
    // 1. Test operation-level extension (has priority)
    const operationExtensionTool = mappedTools.find(tool => 
      tool.apiCallDetails.pathTemplate === '/pets' && 
      tool.apiCallDetails.method === 'GET'
    );
    
    expect(operationExtensionTool).toBeDefined();
    if (operationExtensionTool) {
      // x-mcp extension should override the operationId
      expect(operationExtensionTool.mcpToolDefinition.name).toBe('CustomListPets');
      expect(operationExtensionTool.mcpToolDefinition.description).toBe('Custom description for list pets endpoint from x-mcp extension');
    }
    
    // 2. Test path-level extension
    const pathExtensionTool = mappedTools.find(tool => 
      tool.apiCallDetails.pathTemplate === '/pets/{petId}' && 
      tool.apiCallDetails.method === 'GET'
    );
    
    expect(pathExtensionTool).toBeDefined();
    if (pathExtensionTool) {
      // The path-level x-mcp extension should override both name and description
      expect(pathExtensionTool.mcpToolDefinition.name).toBe('CustomPetByIdAPI');
      expect(pathExtensionTool.mcpToolDefinition.description).toBe('Custom path-level description for pet by ID endpoint');
    }
    
    // 3. Verify that operations without x-mcp extension use default values
    const regularTool = mappedTools.find(tool => 
      tool.apiCallDetails.pathTemplate === '/pets' && 
      tool.apiCallDetails.method === 'POST'
    );
    
    expect(regularTool).toBeDefined();
    if (regularTool) {
      // Should use the original operationId and description
      expect(regularTool.mcpToolDefinition.name).toBe('createPet');
    }
  });
});
