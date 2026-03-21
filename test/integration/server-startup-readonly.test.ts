describe('server startup in read-only mode', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('starts successfully when wallet resolution fails and initializes SunKit without a wallet', async () => {
    const sunKitCtor = jest.fn().mockImplementation(function SunKitMock(this: any, options: any) {
      this.options = options
    })
    const sunApiCtor = jest.fn().mockImplementation(function SunApiMock(this: any) {
      return this
    })
    const registerSunswapTools = jest.fn()
    const connect = jest.fn(async () => undefined)
    const tool = jest.fn()

    jest.doMock('@bankofai/agent-wallet', () => ({
      resolveWalletProvider: jest.fn(() => {
        throw new Error('wallet unavailable')
      }),
    }))

    jest.doMock('@bankofai/sun-kit', () => ({
      SunKit: sunKitCtor,
      SunAPI: sunApiCtor,
      createReadonlyTronWeb: jest.fn(),
    }))

    jest.doMock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
      McpServer: jest.fn().mockImplementation(function McpServerMock(this: any) {
        this.tool = tool
        this.connect = connect
      }),
    }))

    jest.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: jest.fn().mockImplementation(function StdioServerTransportMock(
        this: any,
      ) {
        return this
      }),
    }))

    jest.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
      StreamableHTTPServerTransport: jest.fn(),
    }))

    jest.doMock('../../src/config', () => ({
      config: {
        transport: 'stdio',
        specConfigs: [
          {
            specPath: '/tmp/test-spec.json',
            overlayPaths: [],
            targetApiBaseUrl: 'https://example.com',
            requestTimeoutMs: 30000,
            customHeaders: {},
            disableXMcp: false,
            filter: { whitelist: null, blacklist: [] },
          },
        ],
      },
    }))

    jest.doMock('../../src/openapiProcessor', () => ({
      getProcessedOpenApi: jest.fn(async () => ({
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })),
    }))

    jest.doMock('../../src/mcpMapper', () => ({
      mapOpenApiToMcpTools: jest.fn(() => []),
    }))

    jest.doMock('../../src/tools', () => ({
      registerSunswapTools,
    }))

    const { startServer } = await import('../../src/server')

    await expect(startServer()).resolves.toBeUndefined()
    expect(sunKitCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet: undefined,
        network: 'mainnet',
      }),
    )
    expect(registerSunswapTools).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        api: expect.anything(),
        kit: expect.anything(),
      }),
    )
  })
})
