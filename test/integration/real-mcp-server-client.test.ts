import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getProcessedOpenApi } from '../../src/openapiProcessor'
import { mapOpenApiToMcpTools } from '../../src/mcpMapper'
import { testConfig } from '../fixtures/test-config'
import type { MappedTool } from '../../src/types'
import type { SpecConfig } from '../../src/config'
import path from 'path'

jest.mock('../../src/apiClient', () => ({
  executeApiCall: jest.fn().mockImplementation(async (apiCallDetails) => {
    const op = apiCallDetails.operationId
    if (op === 'getPrice' || apiCallDetails.pathTemplate === '/apiv2/price') {
      return {
        success: true,
        data: testConfig.mockResponses.getPrice,
        statusCode: 200,
        headers: new Headers(),
      }
    }
    if (op === 'getPools' || apiCallDetails.pathTemplate === '/apiv2/pools') {
      return {
        success: true,
        data: testConfig.mockResponses.getPools,
        statusCode: 200,
        headers: new Headers(),
      }
    }
    return {
      success: true,
      data: { code: 0, msg: 'success', data: {} },
      statusCode: 200,
      headers: new Headers(),
    }
  }),
}))

interface ExtraParams {
  params: Record<string, any>
  [key: string]: any
}

interface ToolCallResponse {
  content: Array<{ type: string; text: string }>
}

describe('MCP Tool Integration Tests with Direct Handler Calls (SUN.IO)', () => {
  let mcpServer: McpServer
  let mappedTools: MappedTool[]
  let toolHandlers: Record<string, (extra: ExtraParams) => Promise<ToolCallResponse>>

  const testSpecConfig: SpecConfig = {
    specPath: path.resolve(process.cwd(), testConfig.openApiFile),
    overlayPaths: [],
    targetApiBaseUrl: testConfig.baseUrl,
    requestTimeoutMs: 30000,
    customHeaders: {},
    disableXMcp: false,
    filter: { whitelist: null, blacklist: [] },
  }

  beforeAll(async () => {
    const openapiSpec = await getProcessedOpenApi(testSpecConfig)
    mappedTools = mapOpenApiToMcpTools(openapiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    })

    mcpServer = new McpServer({ name: 'SUN.IO Test MCP Server', version: '1.0.0' })
    toolHandlers = {}

    for (const tool of mappedTools) {
      const { mcpToolDefinition, apiCallDetails } = tool
      const handler = async (extra: ExtraParams): Promise<ToolCallResponse> => {
        const { executeApiCall } = require('../../src/apiClient')
        const result = await executeApiCall(apiCallDetails, extra.params)

        if (!result.success) {
          throw new Error(result.error || `API Error ${result.statusCode}`)
        }

        return { content: [{ type: 'text', text: JSON.stringify(result.data) }] }
      }

      toolHandlers[mcpToolDefinition.name] = handler
      mcpServer.tool(mcpToolDefinition.name, mcpToolDefinition.description, handler)
    }
  })

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.close()
    }
  })

  it('registers key SUN.IO tools', () => {
    const toolNames = Object.keys(toolHandlers)
    expect(toolNames.length).toBe(mappedTools.length)
    expect(toolNames).toContain('getPrice')
    expect(toolNames).toContain('getPools')
  })

  it('calls getPrice handler directly', async () => {
    const handler = toolHandlers['getPrice']
    const response = await handler({ params: { symbol: 'SUN' }, request: { id: 'req-1' } })

    expect(response.content[0].type).toBe('text')
    const payload = JSON.parse(response.content[0].text)
    expect(payload).toEqual(testConfig.mockResponses.getPrice)
  })

  it('calls getPools handler directly', async () => {
    const handler = toolHandlers['getPools']
    const response = await handler({ params: { protocol: 'V3' }, request: { id: 'req-2' } })

    expect(response.content[0].type).toBe('text')
    const payload = JSON.parse(response.content[0].text)
    expect(payload).toEqual(testConfig.mockResponses.getPools)
  })

  it('propagates API client errors through handlers', async () => {
    const apiClient = require('../../src/apiClient')
    apiClient.executeApiCall.mockImplementationOnce(async () => ({
      success: false,
      error: 'Test error message',
      statusCode: 500,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    }))

    const handler = toolHandlers['getPrice']
    await expect(handler({ params: { symbol: 'SUN' }, request: { id: 'req-3' } })).rejects.toThrow(
      'Test error message',
    )
  })
})
