import type { TronWeb } from "tronweb";
import { getWallet, type WalletContext, type AgentWalletProvider } from "./wallet";

export interface ContractCallParams {
  address: string;
  functionName: string;
  args?: any[];
  abi?: any[];
}

export interface ContractSendParams extends ContractCallParams {
  /**
   * Optional TRX value to send with the call, in Sun.
   */
  value?: string;
}

/**
 * Step 1: Get transaction parameters and perform a read-only contract call.
 */
export async function readContract(
  params: ContractCallParams,
  network = "mainnet",
): Promise<unknown> {
  const wallet = getWallet({ network });
  const tronWeb: TronWeb =
    wallet.type === "local" ? wallet.tronWeb : (await getReadonlyTronWeb(network));

  try {
    const contract = params.abi
      ? tronWeb.contract(params.abi, params.address)
      : await tronWeb.contract().at(params.address);

    const method = (contract as any).methods[params.functionName];
    if (!method) {
      throw new Error(`Function ${params.functionName} not found in contract`);
    }

    const args = params.args || [];
    return await method(...args).call();
  } catch (error: any) {
    throw new Error(`Read contract failed: ${error.message}`);
  }
}

/**
 * Step 2: Build an unsigned transaction for a state-changing contract call.
 *
 * Uses triggerSmartContract with the full function selector (e.g.
 * "swapExactInput(address,uint256,...)") and typed parameter array
 * derived from the contract ABI.
 */
export async function buildUnsignedContractTx(
  tronWeb: TronWeb,
  params: ContractSendParams,
): Promise<unknown> {
  const args = params.args || [];
  const options: any = {};
  if (params.value) {
    options.callValue = params.value;
  }

  const contract = params.abi
    ? tronWeb.contract(params.abi, params.address)
    : await tronWeb.contract().at(params.address);

  // Resolve the ABI array – tronWeb.contract().at() stores it on the instance.
  const abi: any[] = params.abi || (contract as any).abi || [];

  const abiEntry = abi.find(
    (entry: any) => entry.type === "function" && entry.name === params.functionName,
  );
  if (!abiEntry) {
    throw new Error(`Function ${params.functionName} not found in contract ABI`);
  }

  // Build full function selector, e.g. "swapExactInput(address,uint256,address[])"
  const paramTypes = (abiEntry.inputs || []).map((i: any) => i.type).join(",");
  const functionSelector = `${params.functionName}(${paramTypes})`;

  // Build typed parameter array required by triggerSmartContract
  const typedParams = (abiEntry.inputs || []).map((input: any, idx: number) => ({
    type: input.type,
    value: args[idx],
  }));

  const issuerAddress = tronWeb.defaultAddress?.base58 || tronWeb.defaultAddress?.hex || undefined;

  const unsignedTx = await tronWeb.transactionBuilder.triggerSmartContract(
    params.address,
    functionSelector,
    options,
    typedParams,
    issuerAddress,
  );

  return unsignedTx;
}

/**
 * Step 3: Sign and broadcast a previously built unsigned transaction
 * using either a local TronWeb wallet or an AgentWallet provider.
 */
export async function signAndBroadcastContractTx(
  wallet: WalletContext,
  unsignedTx: any,
): Promise<unknown> {
  if (wallet.type === "local") {
    const signed = await wallet.tronWeb.trx.sign(unsignedTx.transaction || unsignedTx);
    const result = await wallet.tronWeb.trx.sendRawTransaction(signed);
    return result;
  }

  return wallet.provider.signAndSendTransaction(unsignedTx);
}

/**
 * High-level helper for tools: perform a full write interaction in
 * the sequence of "get params → build unsigned tx → sign & broadcast".
 */
export async function sendContractTx(
  params: ContractSendParams & {
    network?: string;
    provider?: AgentWalletProvider;
  },
): Promise<unknown> {
  const network = params.network || "mainnet";
  const { provider, ...callParams } = params;

  const wallet = getWallet({ network, provider });

  const tronWeb: TronWeb =
    wallet.type === "local" ? wallet.tronWeb : (await getReadonlyTronWeb(network));

  if (wallet.type === "local") {
    // Local wallet: TronWeb instance already has the private key,
    // use contract method .send() which builds, signs, and broadcasts in one step.
    const contract = callParams.abi
      ? tronWeb.contract(callParams.abi, callParams.address)
      : await tronWeb.contract().at(callParams.address);

    const method = (contract as any).methods[callParams.functionName];
    if (!method) {
      throw new Error(`Function ${callParams.functionName} not found in contract`);
    }

    const args = callParams.args || [];
    const options: any = {};
    if (callParams.value) {
      options.callValue = callParams.value;
    }

    return method(...args).send(options);
  }

  // Agent wallet: build unsigned tx, then delegate signing to the provider.
  const unsignedTx = await buildUnsignedContractTx(tronWeb, callParams);
  return signAndBroadcastContractTx(wallet, unsignedTx);
}

export async function getReadonlyTronWeb(network: string): Promise<TronWeb> {
  // Lightweight TronWeb instance for read-only calls.
  const tronwebModule = await import("tronweb");
  const TronWebCtor = (tronwebModule as any).default ?? (tronwebModule as any).TronWeb;
  if (!TronWebCtor) {
    throw new Error("Unable to load TronWeb constructor from 'tronweb' module");
  }
  const { getNetworkConfig } = await import("./chains");
  const config = getNetworkConfig(network);
  const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_GRID_API_KEY;

  return new TronWebCtor({
    fullHost: config.fullNode,
    solidityNode: config.solidityNode,
    eventServer: config.eventServer,
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined,
  }) as TronWeb;
}

