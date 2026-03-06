import { sendContractTx } from "./contracts";
import type { AgentWalletProvider } from "./wallet";

export interface AddLiquidityV2Params {
  network?: string;
  routerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin: string;
  amountBMin: string;
  to: string;
  deadline: string | number;
}

export interface RemoveLiquidityV2Params {
  network?: string;
  routerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenA: string;
  tokenB: string;
  liquidity: string;
  amountAMin: string;
  amountBMin: string;
  to: string;
  deadline: string | number;
}

export async function addLiquidityV2(params: AddLiquidityV2Params): Promise<unknown> {
  const args = [
    params.tokenA,
    params.tokenB,
    params.amountADesired,
    params.amountBDesired,
    params.amountAMin,
    params.amountBMin,
    params.to,
    params.deadline,
  ];

  return sendContractTx({
    address: params.routerAddress,
    functionName: "addLiquidity",
    args,
    abi: params.abi,
    network: params.network || "mainnet",
    provider: params.provider,
  });
}

export async function removeLiquidityV2(params: RemoveLiquidityV2Params): Promise<unknown> {
  const args = [
    params.tokenA,
    params.tokenB,
    params.liquidity,
    params.amountAMin,
    params.amountBMin,
    params.to,
    params.deadline,
  ];

  return sendContractTx({
    address: params.routerAddress,
    functionName: "removeLiquidity",
    args,
    abi: params.abi,
    network: params.network || "mainnet",
    provider: params.provider,
  });
}

