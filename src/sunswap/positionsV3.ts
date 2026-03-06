import { sendContractTx } from "./contracts";
import type { AgentWalletProvider } from "./wallet";

export interface MintPositionV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
  recipient: string;
  deadline: string | number;
}

export interface IncreaseLiquidityV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenId: string;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
  deadline: string | number;
}

export interface DecreaseLiquidityV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenId: string;
  liquidity: string;
  amount0Min: string;
  amount1Min: string;
  deadline: string | number;
}

export async function mintPositionV3(params: MintPositionV3Params): Promise<unknown> {
  const args = [
    {
      token0: params.token0,
      token1: params.token1,
      fee: params.fee,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min: params.amount0Min,
      amount1Min: params.amount1Min,
      recipient: params.recipient,
      deadline: params.deadline,
    },
  ];

  return sendContractTx({
    address: params.positionManagerAddress,
    functionName: "mint",
    args,
    abi: params.abi,
    network: params.network || "mainnet",
    provider: params.provider,
  });
}

export async function increaseLiquidityV3(
  params: IncreaseLiquidityV3Params,
): Promise<unknown> {
  const args = [
    {
      tokenId: params.tokenId,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min: params.amount0Min,
      amount1Min: params.amount1Min,
      deadline: params.deadline,
    },
  ];

  return sendContractTx({
    address: params.positionManagerAddress,
    functionName: "increaseLiquidity",
    args,
    abi: params.abi,
    network: params.network || "mainnet",
    provider: params.provider,
  });
}

export async function decreaseLiquidityV3(
  params: DecreaseLiquidityV3Params,
): Promise<unknown> {
  const args = [
    {
      tokenId: params.tokenId,
      liquidity: params.liquidity,
      amount0Min: params.amount0Min,
      amount1Min: params.amount1Min,
      deadline: params.deadline,
    },
  ];

  return sendContractTx({
    address: params.positionManagerAddress,
    functionName: "decreaseLiquidity",
    args,
    abi: params.abi,
    network: params.network || "mainnet",
    provider: params.provider,
  });
}

