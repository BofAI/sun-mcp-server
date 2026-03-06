import { readContract, sendContractTx, type ContractSendParams } from "./contracts";
import type { AgentWalletProvider } from "./wallet";

export interface QuoteExactInputParams {
  network?: string;
  routerAddress: string;
  functionName?: string; // default: quoteExactInput or getAmountsOut-style
  args: any[];
  abi?: any[];
}

export async function quoteExactInput(params: QuoteExactInputParams): Promise<unknown> {
  const functionName = params.functionName || "quoteExactInput";
  return readContract(
    {
      address: params.routerAddress,
      functionName,
      args: params.args,
      abi: params.abi,
    },
    params.network || "mainnet",
  );
}

export interface SwapExactInputParams {
  network?: string;
  routerAddress: string;
  functionName?: string; // default: swapExactInput
  args: any[];
  value?: string;
  abi?: any[];
  provider?: AgentWalletProvider;
}

export async function swapExactInput(params: SwapExactInputParams): Promise<unknown> {
  const functionName = params.functionName || "swapExactInput";

  const sendParams: ContractSendParams & { network?: string; provider?: AgentWalletProvider } = {
    address: params.routerAddress,
    functionName,
    args: params.args,
    value: params.value,
    abi: params.abi,
    network: params.network || "mainnet",
    provider: params.provider,
  };

  // This uses the standard flow:
  // 1) build unsigned tx
  // 2) wallet signs
  // 3) broadcast
  return sendContractTx(sendParams);
}

