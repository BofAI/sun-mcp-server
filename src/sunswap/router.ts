import { readContract, sendContractTx, type ContractSendParams } from "./contracts";

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
}

export async function swapExactInput(params: SwapExactInputParams): Promise<unknown> {
  const functionName = params.functionName || "swapExactInput";

  const sendParams: ContractSendParams & { network?: string } = {
    address: params.routerAddress,
    functionName,
    args: params.args,
    value: params.value,
    abi: params.abi,
    network: params.network || "mainnet",
  };

  return sendContractTx(sendParams);
}
