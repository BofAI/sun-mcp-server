import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getProcessedOpenApi } from '../../src/openapiProcessor'
import { mapOpenApiToMcpTools } from '../../src/mcpMapper'
import { executeApiCall } from '../../src/apiClient'
import path from 'path'
import { testConfig } from '../fixtures/test-config'
import type { SpecConfig } from '../../src/config'

jest.mock('../../src/apiClient', () => ({
  executeApiCall: jest.fn().mockImplementation(async (apiCallDetails) => {
    if (
      apiCallDetails.operationId === 'getPrice' ||
      apiCallDetails.pathTemplate === '/apiv2/price'
    ) {
      return { success: true, data: testConfig.mockResponses.getPrice, statusCode: 200 }
    }
    if (
      apiCallDetails.operationId === 'getPools' ||
      apiCallDetails.pathTemplate === '/apiv2/pools'
    ) {
      return { success: true, data: testConfig.mockResponses.getPools, statusCode: 200 }
    }
    return {
      success: true,
      data: { code: 0, msg: 'success', data: {} },
      statusCode: 200,
    }
  }),
}))

interface TestMcpServer extends McpServer {
  tools?: Record<string, (...args: any[]) => any>
}

class MockTestTransport {
  private tools: Record<string, (...args: any[]) => any> = {}

  async connect(server: TestMcpServer) {
    if (server.tools) {
      for (const [name, handler] of Object.entries(server.tools)) {
        if (typeof handler === 'function') {
          this.tools[name] = handler
        }
      }
    }
    return Promise.resolve()
  }

  async callTool(toolName: string, params: any) {
    if (!this.tools[toolName]) {
      return {
        error: {
          code: 'tool_not_found',
          message: `Tool '${toolName}' not found`,
        },
      }
    }

    try {
      return await this.tools[toolName]({ params, request: { id: 'test-request-id' } })
    } catch (error: any) {
      return {
        error: {
          code: error.code || 'tool_error',
          message: error.message || 'Unknown error',
        },
      }
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
}

export async function setupTestMcpServer() {
  const openapiSpec = await getProcessedOpenApi(TEST_SPEC_CONFIG)
  const mappedTools = mapOpenApiToMcpTools(openapiSpec, {
    targetApiBaseUrl: testConfig.baseUrl,
    filter: TEST_SPEC_CONFIG.filter,
  })

  const server = new McpServer({
    name: 'Test SUN.IO MCP Server',
    version: '1.0.0',
  }) as TestMcpServer

  server.tools = {}

  for (const tool of mappedTools) {
    const { mcpToolDefinition, apiCallDetails } = tool
    const handler = async (extra: any) => {
      const input = extra.params
      const result = await executeApiCall(apiCallDetails, input)

      if (!result.success) {
        throw new Error(result.error || `API Error ${result.statusCode}`)
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      }
    }

    if (server.tools) {
      server.tools[mcpToolDefinition.name] = handler
    }

    server.tool(mcpToolDefinition.name, mcpToolDefinition.description, handler)
  }

  const transport = new MockTestTransport()
  await transport.connect(server)

  return { server, transport, mappedTools }
}

export async function teardownTestMcpServer(server: TestMcpServer) {
  try {
    await server.close()
  } catch (error) {
    console.error('Error closing server:', error)
  }
}

export async function invokeToolForTest(
  transport: MockTestTransport,
  toolName: string,
  params: any,
) {
  return transport.callTool(toolName, params)
}
