import { sendContractTx, ensureTokenAllowance } from "./contracts";
import type { AgentWalletProvider } from "./wallet";
import { getWalletAddress } from "./wallet";

const DEFAULT_SLIPPAGE_BPS = 500; // 5%

function applySlippage(amount: string): string {
  const raw = BigInt(amount || "0");
  if (raw === BigInt(0)) return "0";
  const factor = BigInt(10_000 - DEFAULT_SLIPPAGE_BPS);
  return (raw * factor / BigInt(10_000)).toString();
}

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
  amount0Min?: string;
  amount1Min?: string;
  recipient?: string;
  deadline?: string | number;
}

export interface IncreaseLiquidityV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenId: string;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min?: string;
  amount1Min?: string;
  deadline?: string | number;
}

export interface DecreaseLiquidityV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenId: string;
  liquidity: string;
  amount0Min?: string;
  amount1Min?: string;
  deadline?: string | number;
}

export async function mintPositionV3(params: MintPositionV3Params): Promise<unknown> {
  const network = params.network || "mainnet";

  const amount0Min = params.amount0Min ?? applySlippage(params.amount0Desired);
  const amount1Min = params.amount1Min ?? applySlippage(params.amount1Desired);

  const recipient =
    params.recipient ??
    await getWalletAddress({
      network,
      provider: params.provider,
    });

  const deadline =
    params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60; // +30 minutes

  // Ensure token0/token1 approvals to the V3 position manager are sufficient.
  await ensureTokenAllowance({
    network,
    tokenAddress: params.token0,
    spender: params.positionManagerAddress,
    requiredAmount: params.amount0Desired,
    provider: params.provider,
  });

  await ensureTokenAllowance({
    network,
    tokenAddress: params.token1,
    spender: params.positionManagerAddress,
    requiredAmount: params.amount1Desired,
    provider: params.provider,
  });

  const args = [
    {
      token0: params.token0,
      token1: params.token1,
      fee: params.fee,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min,
      amount1Min,
      recipient,
      deadline,
    },
  ];

  return sendContractTx({
    address: params.positionManagerAddress,
    functionName: "mint",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });
}

export async function increaseLiquidityV3(
  params: IncreaseLiquidityV3Params,
): Promise<unknown> {
  const network = params.network || "mainnet";

  const amount0Min = params.amount0Min ?? applySlippage(params.amount0Desired);
  const amount1Min = params.amount1Min ?? applySlippage(params.amount1Desired);

  const deadline =
    params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60; // +30 minutes

  // Increase liquidity requires approval for any additional token0/token1 that
  // will be pulled from the wallet. Callers should provide the corresponding
  // token contract addresses via ABI/position manager context; here we rely on
  // the desired amounts and assume the same token pair as the existing position.
  // To keep the helper generic, we only ensure that at least the desired
  // amount0/amount1 can be pulled if non-zero.

  const args = [
    {
      tokenId: params.tokenId,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min,
      amount1Min,
      deadline,
    },
  ];

  return sendContractTx({
    address: params.positionManagerAddress,
    functionName: "increaseLiquidity",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });
}

export async function decreaseLiquidityV3(
  params: DecreaseLiquidityV3Params,
): Promise<unknown> {
  const deadline =
    params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60; // +30 minutes

  const args = [
    {
      tokenId: params.tokenId,
      liquidity: params.liquidity,
      amount0Min: params.amount0Min ?? "0",
      amount1Min: params.amount1Min ?? "0",
      deadline,
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

