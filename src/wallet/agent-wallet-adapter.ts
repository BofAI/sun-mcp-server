/**
 * AgentWalletAdapter — Wallet implementation backed by @bankofai/agent-wallet SDK.
 */

import type { TronWeb } from 'tronweb'
import type { Wallet } from './index'
import { getOwnerAddress, buildSignBroadcast, signMessageWithWallet, signTypedDataWithWallet } from './agent-wallet'
import { createReadonlyTronWeb } from '@bankofai/sun-kit'

export class AgentWalletAdapter implements Wallet {
  readonly type = 'agent-wallet' as const

  async getAddress(): Promise<string> {
    return getOwnerAddress()
  }

  async getTronWeb(network = 'mainnet'): Promise<TronWeb> {
    const tronWeb = await createReadonlyTronWeb(network)

    // Set defaultAddress to the agent-wallet owner so triggerSmartContract
    // uses the correct issuer address.
    const ownerAddress = await getOwnerAddress()
    const ownerHex = typeof (tronWeb as any).address?.toHex === 'function' ? (tronWeb as any).address.toHex(ownerAddress) : ownerAddress
    const ownerBase58 = typeof (tronWeb as any).address?.fromHex === 'function' ? (tronWeb as any).address.fromHex(ownerHex) : ownerAddress
    ;(tronWeb as any).defaultAddress = { hex: ownerHex, base58: ownerBase58 }

    return tronWeb
  }

  async signAndBroadcast(unsignedTx: Record<string, unknown>, network = 'mainnet'): Promise<{ result: boolean; txid: string }> {
    const tx = (unsignedTx as any).transaction || unsignedTx
    const txid = await buildSignBroadcast(tx, network)
    return { result: true, txid }
  }

  async signMessage(message: string): Promise<string> {
    return signMessageWithWallet(message)
  }

  async signTypedData(primaryType: string, domain: Record<string, unknown>, types: Record<string, unknown>, message: Record<string, unknown>): Promise<string> {
    return signTypedDataWithWallet(primaryType, domain, types, message)
  }
}
