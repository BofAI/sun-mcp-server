import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupTestMcpServer, teardownTestMcpServer, invokeToolForTest } from '../utils/testUtils';
import { getProcessedOpenApi } from '../../src/openapiProcessor';
import { mapOpenApiToMcpTools } from '../../src/mcpMapper';
import { testConfig } from '../fixtures/test-config';
import type { SpecConfig } from '../../src/config';
import path from 'path';

describe('SUN.IO MCP Server Integration Tests', () => {
  let server: McpServer;
  let transport: any;
  let mappedTools: any[];
  let registeredToolNames: string[] = [];

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
    const setup = await setupTestMcpServer();
    server = setup.server;
    transport = setup.transport;
    mappedTools = setup.mappedTools;
    registeredToolNames = mappedTools.map((tool) => tool.mcpToolDefinition.name);
  });

  afterAll(async () => {
    await teardownTestMcpServer(server as any);
  });

  it('processes SUN.IO OpenAPI specification', async () => {
    const openapiSpec = await getProcessedOpenApi(testSpecConfig);
    expect(openapiSpec.paths['/apiv2/price']).toBeDefined();
    expect(openapiSpec.paths['/apiv2/pools']).toBeDefined();
  });

  it('maps SUN.IO operations to MCP tools', async () => {
    const openapiSpec = await getProcessedOpenApi(testSpecConfig);
    const tools = mapOpenApiToMcpTools(openapiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    });

    expect(tools.length).toBeGreaterThan(20);
    const toolNames = tools.map((t) => t.mcpToolDefinition.name);
    expect(toolNames).toContain('getPrice');
    expect(toolNames).toContain('getPools');
  });

  it('registers tools with MCP server', async () => {
    expect(mappedTools.length).toBeGreaterThan(20);

    for (const toolName of registeredToolNames.slice(0, 3)) {
      const result = await invokeToolForTest(transport, toolName, {});
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
    }

    expect(registeredToolNames).toContain('getPrice');
    expect(registeredToolNames).toContain('getPools');
  });

  it('invokes getPrice successfully', async () => {
    const result = await invokeToolForTest(transport, 'getPrice', { symbol: 'SUN,TRX' });
    expect(result.content?.[0]?.type).toBe('text');

    const parsedData = JSON.parse(result.content[0].text);
    expect(parsedData.code).toBe(0);
  });

  it('invokes getPools successfully', async () => {
    const result = await invokeToolForTest(transport, 'getPools', { protocol: 'V3', pageSize: 10 });
    expect(result.content?.[0]?.type).toBe('text');

    const parsedData = JSON.parse(result.content[0].text);
    expect(parsedData.code).toBe(0);
  });

  it('handles invalid parameter containers gracefully', async () => {
    let result = await invokeToolForTest(transport, 'getPrice', null as any);
    expect(result).toBeDefined();

    result = await invokeToolForTest(transport, 'getPrice', [] as any);
    expect(result).toBeDefined();

    result = await invokeToolForTest(transport, 'getPrice', 'invalid' as any);
    expect(result).toBeDefined();
  });
});
