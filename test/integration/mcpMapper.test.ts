import path from 'path'
import { mapOpenApiToMcpTools } from '../../src/mcpMapper'
import { getProcessedOpenApi } from '../../src/openapiProcessor'
import { testConfig } from '../fixtures/test-config'
import type { SpecConfig } from '../../src/config'

describe('MCP Mapper Integration Tests (SUN.IO)', () => {
  let openApiSpec: any
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
    openApiSpec = await getProcessedOpenApi(testSpecConfig)
  })

  it('maps SUN.IO operations to MCP tools', () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    })

    expect(mappedTools).toBeDefined()
    expect(Array.isArray(mappedTools)).toBe(true)
    expect(mappedTools.length).toBeGreaterThan(20)

    const toolNames = mappedTools.map((t) => t.mcpToolDefinition.name)
    expect(toolNames).toContain('getPrice')
    expect(toolNames).toContain('getPools')
  })

  it('preserves query parameter metadata for getPrice', () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    })

    const priceTool = mappedTools.find((t) => t.mcpToolDefinition.name === 'getPrice')
    expect(priceTool).toBeDefined()

    const tokenAddressSchema = priceTool?.mcpToolDefinition.inputSchema.properties
      ?.tokenAddress as any
    expect(tokenAddressSchema).toBeDefined()
    expect(tokenAddressSchema['x-parameter-location']).toBe('query')
    expect(tokenAddressSchema.type).toBe('string')
  })

  it('maps API call details correctly for getPools', () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    })

    const poolsTool = mappedTools.find((t) => t.mcpToolDefinition.name === 'getPools')
    expect(poolsTool).toBeDefined()
    expect(poolsTool?.apiCallDetails.method).toBe('GET')
    expect(poolsTool?.apiCallDetails.pathTemplate).toBe('/apiv2/pools')
    expect(poolsTool?.apiCallDetails.serverUrl).toBe(testConfig.baseUrl)
  })

  it('supports whitelist filtering by operationId glob', () => {
    const filteredTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: {
        whitelist: ['getFarm*'],
        blacklist: [],
      },
    })

    const names = filteredTools.map((t) => t.mcpToolDefinition.name)
    expect(names.length).toBeGreaterThan(0)
    expect(names.every((name) => name.startsWith('getFarm'))).toBe(true)
  })

  it('supports blacklist filtering', () => {
    const filteredTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: {
        whitelist: null,
        blacklist: ['getPrice', 'getPools'],
      },
    })

    const names = filteredTools.map((t) => t.mcpToolDefinition.name)
    expect(names).not.toContain('getPrice')
    expect(names).not.toContain('getPools')
    expect(names.length).toBeGreaterThan(10)
  })

  it('applies x-mcp overrides from SUN.IO overlay', async () => {
    const overlaySpec = await getProcessedOpenApi({
      ...testSpecConfig,
      overlayPaths: [path.resolve(process.cwd(), testConfig.overlayFile)],
    })

    const mappedTools = mapOpenApiToMcpTools(overlaySpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: testSpecConfig.filter,
    })

    const toolNames = mappedTools.map((t) => t.mcpToolDefinition.name)
    expect(toolNames).toContain('sunSwapGetPools')
    expect(toolNames).toContain('sunSwapGetTokenPrice')
  })
})
