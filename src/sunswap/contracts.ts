import type { TronWeb } from 'tronweb'
import { getWallet } from '../wallet'
import { getReadonlyTronWeb } from '../wallet/tronweb'
import { TRC20_MIN_ABI } from './constants'

export interface ContractCallParams {
  address: string
  functionName: string
  args?: any[]
  abi?: any[]
}

export interface ContractSendParams extends ContractCallParams {
  /**
   * Optional TRX value to send with the call, in Sun.
   */
  value?: string
}

/**
 * Step 1: Get transaction parameters and perform a read-only contract call.
 */
export async function readContract(params: ContractCallParams, network = 'mainnet'): Promise<unknown> {
  const tronWeb = await getReadonlyTronWeb(network)

  try {
    const contract = params.abi ? tronWeb.contract(params.abi, params.address) : await tronWeb.contract().at(params.address)

    const method = (contract as any).methods[params.functionName]
    if (!method) {
      throw new Error(`Function ${params.functionName} not found in contract`)
    }

    const args = params.args || []
    return await method(...args).call()
  } catch (error: any) {
    throw new Error(`Read contract failed: ${error.message}`)
  }
}

/**
 * Step 2: Build an unsigned transaction for a state-changing contract call.
 *
 * Uses triggerSmartContract with the full function selector (e.g.
 * "swapExactInput(address,uint256,...)") and typed parameter array
 * derived from the contract ABI.
 */
export async function buildUnsignedContractTx(tronWeb: TronWeb, params: ContractSendParams): Promise<unknown> {
  const args = params.args || []
  const options: any = {}
  if (params.value) {
    options.callValue = params.value
  }

  const contract = params.abi ? tronWeb.contract(params.abi, params.address) : await tronWeb.contract().at(params.address)

  // Resolve the ABI array – tronWeb.contract().at() stores it on the instance.
  const abi: any[] = params.abi || (contract as any).abi || []

  const abiEntry = abi.find((entry: any) => entry.type === 'function' && entry.name === params.functionName)
  if (!abiEntry) {
    throw new Error(`Function ${params.functionName} not found in contract ABI`)
  }

  // Build full function selector, e.g. "swapExactInput(address,uint256,address[])"
  const paramTypes = (abiEntry.inputs || []).map((i: any) => i.type).join(',')
  const functionSelector = `${params.functionName}(${paramTypes})`

  // Build typed parameter array required by triggerSmartContract
  const typedParams = (abiEntry.inputs || []).map((input: any, idx: number) => ({
    type: input.type,
    value: args[idx],
  }))

  const issuerAddress = tronWeb.defaultAddress?.base58 || tronWeb.defaultAddress?.hex || undefined

  const unsignedTx = await tronWeb.transactionBuilder.triggerSmartContract(params.address, functionSelector, options, typedParams, issuerAddress)

  return unsignedTx
}

/**
 * Step 2b: Build an unsigned transaction using a raw function selector
 * and typed parameters — no ABI required.
 */
export interface RawContractTxParams {
  address: string
  functionSelector: string
  parameter: { type: string; value: unknown }[]
  callValue?: number
  feeLimit?: number
}

export async function buildRawContractTx(tronWeb: TronWeb, params: RawContractTxParams): Promise<unknown> {
  const options: any = {}
  if (params.callValue != null) {
    options.callValue = params.callValue
  }
  if (params.feeLimit != null) {
    options.feeLimit = params.feeLimit
  }

  const unsignedTx = await tronWeb.transactionBuilder.triggerSmartContract(params.address, params.functionSelector, options, params.parameter)

  return unsignedTx
}

/**
 * Step 3: Sign and broadcast a previously built unsigned transaction
 * using the global Wallet singleton.
 */
export async function signAndBroadcastContractTx(unsignedTx: any, network = 'mainnet'): Promise<unknown> {
  const wallet = getWallet()
  return wallet.signAndBroadcast(unsignedTx, network)
}

/**
 * High-level helper for tools: perform a full write interaction in
 * the sequence of "get params → build unsigned tx → sign & broadcast".
 */
export async function sendContractTx(
  params: ContractSendParams & {
    network?: string
  },
): Promise<unknown> {
  const network = params.network || 'mainnet'
  const wallet = getWallet()
  const tronWeb = await wallet.getTronWeb(network)

  const unsignedTx = await buildUnsignedContractTx(tronWeb, params)
  return wallet.signAndBroadcast(unsignedTx as Record<string, unknown>, network)
}

/**
 * Read-only contract call via solidity node (walletsolidity/triggerconstantcontract).
 * Use this for view calls like allowance so the request goes to the read path
 * instead of full node's wallet/triggerconstantcontract.
 */
export async function readConstantContractSolidity(
  tronWeb: TronWeb,
  contractAddress: string,
  functionSelector: string,
  parameters: { type: string; value: string }[],
  issuerAddressHex: string,
): Promise<string[]> {
  const feeLimit = (tronWeb as any).feeLimit != null ? (tronWeb as any).feeLimit : 100_000_000
  const tx = await (tronWeb.transactionBuilder as any).triggerConfirmedConstantContract(contractAddress, functionSelector, { callValue: 0, feeLimit }, parameters, issuerAddressHex)
  if (!tx || !Array.isArray(tx.constant_result)) {
    throw new Error('Read contract (solidity) failed: no constant_result')
  }
  return tx.constant_result
}

/**
 * Ensure that a TRC20 token has at least `requiredAmount` allowance granted
 * from the active wallet to the given spender. If the allowance is lower,
 * this helper will submit an `approve(spender, requiredAmount)` transaction.
 */
export async function ensureTokenAllowance(params: {
  network?: string
  tokenAddress: string
  spender: string
  requiredAmount: string
}): Promise<void> {
  const network = params.network || 'mainnet'
  const wallet = getWallet()
  const tronWeb = await wallet.getTronWeb(network)
  const ownerAddress = await wallet.getAddress()

  if (!ownerAddress) {
    throw new Error('Unable to resolve wallet address for allowance check.')
  }

  const ownerHex = typeof (tronWeb as any).address?.toHex === 'function' ? (tronWeb as any).address.toHex(ownerAddress) : ownerAddress

  const parameters = [
    { type: 'address', value: ownerAddress },
    { type: 'address', value: params.spender },
  ]

  const constantResult = await readConstantContractSolidity(tronWeb, params.tokenAddress, 'allowance(address,address)', parameters, ownerHex)

  const currentRaw = constantResult[0]
  const current = BigInt(currentRaw ? '0x' + currentRaw : '0')
  const required = BigInt(params.requiredAmount)

  if (required === BigInt(0) || current >= required) {
    return
  }

  await sendContractTx({
    address: params.tokenAddress,
    functionName: 'approve',
    args: [params.spender, params.requiredAmount],
    abi: TRC20_MIN_ABI,
    network,
  })
}