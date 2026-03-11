/**
 * Agent-wallet integration layer for sun-mcp-server.
 *
 * Pure agent-wallet SDK module — handles only encrypted wallet operations.
 * Local/legacy wallet (TRON_PRIVATE_KEY / TRON_MNEMONIC) is handled
 * entirely by wallet.ts and contracts.ts.
 */

import { WalletFactory, type LocalWalletProvider, type BaseWallet, type Eip712Capable, SecureKVStore, TronWallet, loadConfig, saveConfig } from '@bankofai/agent-wallet'
import { homedir } from 'os'
import { join } from 'path'
import { getReadonlyTronWeb } from './tronweb'

// Default agent-wallet directory (same as agent-wallet CLI)
const DEFAULT_WALLET_DIR = join(homedir(), '.agent-wallet')

// ---------------------------------------------------------------------------
// Module-level singleton state
// ---------------------------------------------------------------------------

let provider: LocalWalletProvider | null = null
let activeWallet: BaseWallet | null = null
let activeAddress: string | null = null

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

/** Resolve the agent-wallet secrets directory. Expands leading ~ to $HOME. */
function getWalletDir(): string {
  const dir = process.env.AGENT_WALLET_DIR || DEFAULT_WALLET_DIR
  if (dir.startsWith('~/')) {
    return join(homedir(), dir.slice(2))
  }
  return dir
}

/** True when agent-wallet is configured (password is required). */
export function isAgentWalletConfigured(): boolean {
  return !!process.env.AGENT_WALLET_PASSWORD
}

// ---------------------------------------------------------------------------
// Provider initialization (lazy)
// ---------------------------------------------------------------------------

function getProvider(): LocalWalletProvider {
  if (provider) return provider

  const secretsDir = getWalletDir()
  const password = process.env.AGENT_WALLET_PASSWORD!

  provider = WalletFactory({ secretsDir, password }) as LocalWalletProvider
  return provider
}

// ---------------------------------------------------------------------------
// Active wallet management
// ---------------------------------------------------------------------------

/**
 * Get the currently active agent-wallet. Lazily initializes provider and
 * uses the active wallet from agent-wallet config (or first available wallet).
 */
export async function getActiveWallet(): Promise<BaseWallet> {
  if (activeWallet) return activeWallet

  const p = getProvider()
  activeWallet = await p.getActive()
  activeAddress = await activeWallet.getAddress()
  return activeWallet
}

/**
 * Get the address of the active agent-wallet.
 */
export async function getOwnerAddress(): Promise<string> {
  if (activeAddress) return activeAddress
  const wallet = await getActiveWallet()
  activeAddress = await wallet.getAddress()
  return activeAddress!
}

/**
 * Switch the active wallet at runtime.
 * Persists the choice to agent-wallet config.
 */
export async function selectWallet(walletId: string): Promise<{ id: string; address: string }> {
  const p = getProvider()
  p.setActive(walletId)
  const wallet = await p.getWallet(walletId)
  const address = await wallet.getAddress()

  // Update cached state
  activeWallet = wallet
  activeAddress = address

  return { id: walletId, address }
}

/**
 * List all available agent-wallets. Returns wallet info with addresses.
 */
export async function listAgentWallets(): Promise<Array<{ id: string; type: string; address: string }>> {
  const p = getProvider()
  const wallets = await p.listWallets()

  const result: Array<{ id: string; type: string; address: string }> = []

  for (const w of wallets) {
    const wallet = await p.getWallet(w.id)
    const address = await wallet.getAddress()
    result.push({ id: w.id, type: w.type, address })
  }

  return result
}

/**
 * Get the currently active wallet ID.
 * Reads from agent-wallet config's `active_wallet` field.
 */
export function getActiveWalletId(): string | null {
  const p = getProvider()
  return p.getActiveId()
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * Sign an unsigned transaction via agent-wallet SDK.
 * Returns the signed transaction object (with `signature` array appended).
 */
export async function signTransaction(unsignedTx: Record<string, unknown>): Promise<any> {
  const wallet = await getActiveWallet()
  const signedJson = await wallet.signTransaction(unsignedTx)
  return JSON.parse(signedJson)
}

/**
 * Sign an unsigned transaction and broadcast it. Returns the transaction ID.
 */
export async function buildSignBroadcast(unsignedTx: Record<string, unknown>, network = 'mainnet'): Promise<string> {
  const signedTx = await signTransaction(unsignedTx)
  const tronWeb = await getReadonlyTronWeb(network)
  const result = await tronWeb.trx.sendRawTransaction(signedTx as any)

  if (result.result) {
    return result.txid
  }
  throw new Error(`Broadcast failed: ${JSON.stringify(result)}`)
}

/**
 * Sign a message using the active agent-wallet.
 */
export async function signMessageWithWallet(message: string): Promise<string> {
  const wallet = await getActiveWallet()
  const msgBytes = Buffer.from(message, 'utf-8')
  return await wallet.signMessage(msgBytes)
}

/**
 * Sign a permit2 message and return the signature. Uses the same signing flow
 */
export async function signTypedDataWithWallet(
  primaryType: string,
  domain: Record<string, unknown>,
  types: Record<string, unknown>,
  message: Record<string, unknown>,
): Promise<string> {
  const wallet = await getActiveWallet()
  const signer = wallet as unknown as Eip712Capable
  const sig = await signer.signTypedData({
    domain: domain,
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...types,
    },
    primaryType: primaryType,
    message: message,
  })
  // Normalize to raw hex (no 0x prefix)
  return sig.startsWith('0x') ? sig.slice(2) : sig
}

// ---------------------------------------------------------------------------
// Account generation
// ---------------------------------------------------------------------------

/**
 * Generate a new TRON account and store it in agent-wallet.
 * Returns the wallet ID and address. Private key is never exposed.
 */
export async function generateAndStoreAccount(walletName?: string): Promise<{ walletId: string; address: string }> {
  const secretsDir = getWalletDir()
  const password = process.env.AGENT_WALLET_PASSWORD!

  const walletId = walletName || `tron-${Date.now()}`
  const kvStore = new SecureKVStore(secretsDir, password)
  const privateKeyBytes = kvStore.generateKey(walletId)

  // Derive TRON address
  const tempWallet = new TronWallet(privateKeyBytes)
  const address = await tempWallet.getAddress()

  // Update config
  const config = loadConfig(secretsDir)
  config.wallets[walletId] = {
    type: 'tron_local',
    identity_file: walletId,
  }
  saveConfig(secretsDir, config)

  // Refresh provider to pick up new wallet, then auto-switch to it
  provider = null
  activeWallet = null
  activeAddress = null
  const p = getProvider()
  p.setActive(walletId)

  return { walletId, address }
}
