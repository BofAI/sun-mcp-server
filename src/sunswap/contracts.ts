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

  const method = (contract as any).methods[params.functionName];
  if (!method) {
    throw new Error(`Function ${params.functionName} not found in contract`);
  }

  // Using transactionBuilder to obtain an unsigned transaction object that can be signed.
  const unsignedTx = await tronWeb.transactionBuilder.triggerSmartContract(
    params.address,
    params.functionName,
    options,
    args,
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

  const unsignedTx = await buildUnsignedContractTx(tronWeb, callParams);
  return signAndBroadcastContractTx(wallet, unsignedTx);
}

export async function getReadonlyTronWeb(network: string): Promise<TronWeb> {
  // Lightweight TronWeb instance for read-only calls.
  const { TronWeb } = await import("tronweb");
  const { getNetworkConfig } = await import("./chains");
  const config = getNetworkConfig(network);
  const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_GRID_API_KEY;

  return new TronWeb({
    fullHost: config.fullNode,
    solidityNode: config.solidityNode,
    eventServer: config.eventServer,
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined,
  });
}

