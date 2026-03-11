/**
 * Unified Wallet abstraction for sun-mcp-server.
 *
 * Consumers should call `getWallet()` to obtain a `Wallet` instance and
 * interact with it through the interface — no type branching required.
 *
 * `initWallet()` must be called once at server startup to configure the
 * global singleton based on environment variables.
 */

import type { Wallet } from '@bankofai/sun-kit'
export type { Wallet }

// ---------------------------------------------------------------------------
// Local wallet config helpers (moved from sunswap/wallet.ts)
// ---------------------------------------------------------------------------

import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { HDKey } from '@scure/bip32'
import { TronWeb as TronWebClass } from 'tronweb'

export interface ConfiguredWallet {
  privateKey: string
  address: string
}

export const isLocalWalletConfigured = (): boolean => {
  return !!(process.env.TRON_PRIVATE_KEY || process.env.TRON_MNEMONIC)
}

export const getConfiguredLocalWallet = (): ConfiguredWallet => {
  const privateKey = process.env.TRON_PRIVATE_KEY
  const mnemonic = process.env.TRON_MNEMONIC
  const accountIndexStr = process.env.TRON_ACCOUNT_INDEX || '0'
  const accountIndex = parseInt(accountIndexStr, 10)

  if (isNaN(accountIndex) || accountIndex < 0 || !Number.isInteger(accountIndex)) {
    throw new Error(`Invalid TRON_ACCOUNT_INDEX: "${accountIndexStr}". Must be a non-negative integer.`)
  }

  if (privateKey) {
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
    const address = TronWebClass.address.fromPrivateKey(cleanKey)

    if (!address) {
      throw new Error('Invalid private key provided in TRON_PRIVATE_KEY')
    }

    return { privateKey: cleanKey, address }
  }

  if (mnemonic) {
    if (!bip39.validateMnemonic(mnemonic, wordlist)) {
      throw new Error('Invalid mnemonic provided in TRON_MNEMONIC')
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic)
    const hdKey = HDKey.fromMasterSeed(seed)
    const child = hdKey.derive(`m/44'/195'/0'/0/${accountIndex}`)

    if (!child.privateKey) {
      throw new Error('Failed to derive private key from mnemonic')
    }

    const privateKeyHex = Buffer.from(child.privateKey).toString('hex')
    const address = TronWebClass.address.fromPrivateKey(privateKeyHex)

    return { privateKey: privateKeyHex, address: address as string }
  }

  throw new Error(
    'Neither TRON_PRIVATE_KEY nor TRON_MNEMONIC environment variable is set. ' +
      'Configure one of them to enable write operations, or set AGENT_WALLET_PASSWORD for agent-wallet mode.',
  )
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

import { isAgentWalletConfigured } from './agent-wallet'
import { AgentWalletAdapter } from './agent-wallet-adapter'
import { LocalWallet } from './local-wallet'

let _wallet: Wallet | null = null

/**
 * Initialize the global wallet singleton. Call once at server startup.
 * Priority: agent-wallet > local env keys.
 * If neither is configured, the server runs in read-only mode.
 */
export async function initWallet(): Promise<void> {
  if (isAgentWalletConfigured()) {
    _wallet = new AgentWalletAdapter()
    console.log('Initialized AgentWalletAdapter')
    return
  }

  if (isLocalWalletConfigured()) {
    _wallet = new LocalWallet()
    console.log('Initialized LocalWallet with address')
    return
  }

  // Read-only mode: no wallet configured
  _wallet = null
}

/**
 * Get the global wallet instance. Throws if no wallet is configured.
 */
export function getWallet(): Wallet {
  if (!_wallet) {
    throw new Error('No wallet configured. Set AGENT_WALLET_PASSWORD for agent-wallet mode, ' + 'or TRON_PRIVATE_KEY / TRON_MNEMONIC for a local wallet.')
  }
  return _wallet
}

/**
 * Check if a wallet is available (non-throwing).
 */
export function isWalletConfigured(): boolean {
  return _wallet !== null
}

/**
 * Get the wallet address. Convenience wrapper.
 */
export async function getWalletAddress(): Promise<string> {
  return getWallet().getAddress()
}
