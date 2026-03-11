/**
 * LocalWallet — Wallet implementation backed by a local private key (TronWeb).
 */

import { TronWeb } from 'tronweb'
import { type TypedDataField } from 'tronweb/lib/esm/utils/typedData'
import type { Wallet } from './index'
import { getConfiguredLocalWallet } from './index'
import { getNetworkConfig } from '@bankofai/sun-kit'

export class LocalWallet implements Wallet {
  readonly type = 'local' as const

  private readonly privateKey: string
  private readonly _address: string
  private tronWebCache: Map<string, TronWeb> = new Map()

  constructor() {
    const { privateKey, address } = getConfiguredLocalWallet()
    this.privateKey = privateKey
    this._address = address
  }

  async getAddress(): Promise<string> {
    return this._address
  }

  async getTronWeb(network = 'mainnet'): Promise<TronWeb> {
    const cached = this.tronWebCache.get(network)
    if (cached) return cached

    const config = getNetworkConfig(network)
    const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_GRID_API_KEY

    const tw = new TronWeb({
      fullHost: config.fullNode,
      solidityNode: config.solidityNode,
      eventServer: config.eventServer,
      privateKey: this.privateKey,
      headers: apiKey ? { 'TRON-PRO-API-KEY': apiKey } : undefined,
    })

    this.tronWebCache.set(network, tw)
    return tw
  }

  async signAndBroadcast(unsignedTx: Record<string, unknown>, network = 'mainnet'): Promise<{ result: boolean; txid: string }> {
    const tronWeb = await this.getTronWeb(network)
    const tx = (unsignedTx as any).transaction || unsignedTx
    const signed = await tronWeb.trx.sign(tx)
    const result = await tronWeb.trx.sendRawTransaction(signed)
    return { result: !!(result as any).result, txid: (result as any).txid }
  }

  async signMessage(message: string): Promise<string> {
    const tronWeb = await this.getTronWeb()
    return await tronWeb.trx.sign(message)
  }

  async signTypedData(primaryType: string, domain: Record<string, unknown>, types: Record<string, unknown>, message: Record<string, unknown>): Promise<string> {
    const tronWeb = await this.getTronWeb()
    const sig = tronWeb.trx._signTypedData(domain, types as Record<string, TypedDataField[]>, message)
    // TronWeb returns 0x-prefixed; normalize to raw hex
    return sig.startsWith('0x') ? sig.slice(2) : sig
  }
}
