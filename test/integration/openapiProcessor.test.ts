import path from 'path'
import fs from 'fs/promises'
import { jest } from '@jest/globals'
import { getProcessedOpenApi } from '../../src/openapiProcessor'
import { testConfig } from '../fixtures/test-config'

describe('OpenAPI Processor Integration Tests (SUN.IO)', () => {
  const originalEnv = { ...process.env }
  const originalArgv = [...process.argv]

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    process.env.OPENAPI_SPEC_PATH = path.resolve(process.cwd(), testConfig.openApiFile)
    jest.resetModules()
    jest.dontMock('../../src/config')
  })

  afterAll(() => {
    process.env = originalEnv
    process.argv = originalArgv
  })

  it('loads SUN.IO OpenAPI spec from file', async () => {
    jest.doMock('../../src/config', () => ({
      config: {
        specPath: path.resolve(process.cwd(), testConfig.openApiFile),
        overlayPaths: [],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        customHeaders: {},
        disableXMcp: false,
        filter: { whitelist: null, blacklist: [] },
      },
    }))

    const { getProcessedOpenApi: getProcessedOpenApiClean } = require('../../src/openapiProcessor')
    const openApiSpec = await getProcessedOpenApiClean()

    expect(openApiSpec).toBeDefined()
    expect(openApiSpec.openapi).toBe('3.0.1')
    expect(openApiSpec.info.title).toBe('SUN.IO API v2')
    expect(openApiSpec.paths['/apiv2/price']).toBeDefined()
    expect(openApiSpec.paths['/apiv2/pools']).toBeDefined()
  })

  it('applies SUN.IO overlay when configured', async () => {
    const overlayFilePath = path.resolve(process.cwd(), testConfig.overlayFile)
    const overlay = JSON.parse(await fs.readFile(overlayFilePath, 'utf8')) as {
      overlay: string
      actions: Array<{ target: string; update?: any }>
    }

    expect(overlay.overlay).toBe('1.0.0')

    jest.doMock('../../src/config', () => ({
      config: {
        specPath: path.resolve(process.cwd(), testConfig.openApiFile),
        overlayPaths: [overlayFilePath],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        customHeaders: {},
        disableXMcp: false,
        filter: { whitelist: null, blacklist: [] },
      },
    }))

    const {
      getProcessedOpenApi: getProcessedOpenApiWithOverlay,
    } = require('../../src/openapiProcessor')
    const openApiSpec = await getProcessedOpenApiWithOverlay()

    expect(openApiSpec.info.description).toContain('MCP-oriented descriptions')
    expect(openApiSpec.paths['/apiv2/pools'].get.summary).toBe('Get SUNSWAP pools with filters')
    expect(openApiSpec.paths['/apiv2/price'].get.summary).toBe('Get SUNSWAP token prices')

    const protocolParam = openApiSpec.paths['/apiv2/pools'].get.parameters.find(
      (p: any) => p.name === 'protocol' && p.in === 'query',
    )
    expect(protocolParam).toBeDefined()
    expect(protocolParam.description).toContain('SUNSWAP/SUN.IO pools')
  })

  it('throws for invalid OpenAPI path', async () => {
    jest.doMock('../../src/config', () => ({
      config: {
        specPath: '/path/to/nonexistent/sunio-open-api.json',
        overlayPaths: [],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        customHeaders: {},
        disableXMcp: false,
        filter: { whitelist: null, blacklist: [] },
      },
    }))

    const {
      getProcessedOpenApi: getProcessedOpenApiWithInvalidPath,
    } = require('../../src/openapiProcessor')
    await expect(getProcessedOpenApiWithInvalidPath()).rejects.toThrow()
  })

  it('returns a valid OpenAPI object with operationIds', async () => {
    const openApiSpec = await getProcessedOpenApi()
    expect(openApiSpec).toHaveProperty('openapi')
    expect(openApiSpec).toHaveProperty('info')
    expect(openApiSpec).toHaveProperty('paths')

    let hasOperation = false
    for (const pathItem of Object.values(openApiSpec.paths) as any[]) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
        if (pathItem[method]) {
          hasOperation = true
          expect(pathItem[method]).toHaveProperty('operationId')
          expect(pathItem[method]).toHaveProperty('responses')
        }
      }
    }

    expect(hasOperation).toBe(true)
  })
})
