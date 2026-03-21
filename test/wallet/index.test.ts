// ---------------------------------------------------------------------------
// Common mocks for ESM-only dependencies
// ---------------------------------------------------------------------------
const mockBaseWallet = {
  getAddress: jest.fn(async () => 'T_AGENT_ADDR_mock'),
  signTransaction: jest.fn(async () => JSON.stringify({ txID: 'mock' })),
  signMessage: jest.fn(async () => 'agent_sig'),
  signTypedData: jest.fn(async () => '0xdeadbeef'),
}

jest.mock('tronweb', () => {
  return {
    TronWeb: Object.assign(
      function TronWebMock() {
        return {}
      },
      { address: { fromPrivateKey: jest.fn() } },
    ),
  }
})

jest.mock('@bankofai/agent-wallet', () => ({
  resolveWalletProvider: jest.fn(() => ({
    getActiveWallet: jest.fn(async () => mockBaseWallet),
  })),
  SecureKVStore: class {},
  TronWallet: class {},
  loadConfig: jest.fn(() => ({ wallets: {} })),
  saveConfig: jest.fn(),
}))

jest.mock('@bankofai/sun-kit', () => ({
  createReadonlyTronWeb: jest.fn().mockResolvedValue({}),
  getNetworkConfig: jest.fn(() => ({
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
    eventServer: 'https://api.trongrid.io',
  })),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { resolveWalletProvider } from '@bankofai/agent-wallet'
import { initWallet, getWallet, getWalletAddress, isWalletConfigured } from '../../src/wallet'

// We need to reset the module-level singleton between tests.
// initWallet() sets a module-scoped `_wallet`; to truly isolate tests we
// re-import via `jest.isolateModules` where needed, but for most tests
// calling `initWallet()` with different env vars is sufficient because
// the singleton is overwritten each time.

function cleanEnv() {
  delete process.env.AGENT_WALLET_PASSWORD
  delete process.env.AGENT_WALLET_DIR
  delete process.env.AGENT_WALLET_PRIVATE_KEY
  delete process.env.AGENT_WALLET_MNEMONIC
  delete process.env.AGENT_WALLET_MNEMONIC_ACCOUNT_INDEX
}

beforeEach(cleanEnv)
afterAll(cleanEnv)

const mockResolveWalletProvider = resolveWalletProvider as jest.MockedFunction<
  typeof resolveWalletProvider
>

beforeEach(() => {
  mockResolveWalletProvider.mockReset()
  mockResolveWalletProvider.mockReturnValue({
    getActiveWallet: jest.fn(async () => mockBaseWallet),
  } as any)
})

// ===== initWallet / getWallet / isWalletConfigured =====

describe('initWallet', () => {
  it('initialises with agent wallet when AGENT_WALLET_PRIVATE_KEY is set', async () => {
    process.env.AGENT_WALLET_PRIVATE_KEY =
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

    await initWallet()

    expect(isWalletConfigured()).toBe(true)
    const wallet = getWallet()
    expect(wallet.type).toBe('agent-wallet')
  })

  it('initialises with agent wallet when AGENT_WALLET_PASSWORD is set', async () => {
    process.env.AGENT_WALLET_PASSWORD = 'test-password'

    await initWallet()

    expect(isWalletConfigured()).toBe(true)
    const wallet = getWallet()
    expect(wallet.type).toBe('agent-wallet')
  })

  it('falls back to read-only when wallet provider resolution fails', async () => {
    process.env.AGENT_WALLET_PASSWORD = 'test-password'
    mockResolveWalletProvider.mockImplementation(() => {
      throw new Error('provider init failed')
    })

    await initWallet()

    expect(isWalletConfigured()).toBe(false)
  })

  it('falls back to read-only when getActiveWallet fails', async () => {
    process.env.AGENT_WALLET_PASSWORD = 'test-password'
    mockResolveWalletProvider.mockReturnValue({
      getActiveWallet: jest.fn(async () => {
        throw new Error('wallet load failed')
      }),
    } as any)

    await initWallet()

    expect(isWalletConfigured()).toBe(false)
  })
})

describe('getWallet', () => {
  it('throws when no wallet is configured (read-only mode)', async () => {
    mockResolveWalletProvider.mockImplementation(() => {
      throw new Error('provider init failed')
    })
    await initWallet()

    expect(() => getWallet()).toThrow(/No wallet configured/)
  })
})

describe('getWalletAddress', () => {
  it('returns the address from the active wallet', async () => {
    process.env.AGENT_WALLET_PRIVATE_KEY =
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    await initWallet()

    const address = await getWalletAddress()
    expect(address).toBe('T_AGENT_ADDR_mock')
  })
})
