import { getNetworkConfig, TronNetwork } from '@bankofai/sun-kit'

describe('sunswap chains config', () => {
  it('returns mainnet config as default', () => {
    const cfgDefault = getNetworkConfig()
    const cfgExplicit = getNetworkConfig(TronNetwork.Mainnet)

    expect(cfgDefault.fullNode).toBe(cfgExplicit.fullNode)
    expect(cfgDefault.solidityNode).toBe(cfgExplicit.solidityNode)
    expect(cfgDefault.eventServer).toBe(cfgExplicit.eventServer)
  })

  it('supports common network aliases', () => {
    const mainByTron = getNetworkConfig('tron')
    const mainByTrx = getNetworkConfig('TRX')
    const mainByMainnet = getNetworkConfig('mainnet')

    expect(mainByTron.fullNode).toBe(mainByMainnet.fullNode)
    expect(mainByTrx.fullNode).toBe(mainByMainnet.fullNode)
  })

  it('maps testnet alias to Nile', () => {
    const nile = getNetworkConfig(TronNetwork.Nile)
    const testnet = getNetworkConfig('testnet')

    expect(testnet.fullNode).toBe(nile.fullNode)
  })

  it('honours rpcOverride parameter', () => {
    const cfg = getNetworkConfig('mainnet', 'https://custom-rpc.tron.local')

    expect(cfg.fullNode).toBe('https://custom-rpc.tron.local')
    expect(cfg.solidityNode).toBe('https://custom-rpc.tron.local')
    expect(cfg.eventServer).toBe('https://custom-rpc.tron.local')
  })

  it('throws on unsupported network', () => {
    expect(() => getNetworkConfig('unknown-network')).toThrow(/Unsupported network/)
  })
})
