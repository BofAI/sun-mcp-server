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

export interface AddLiquidityV2Params {
  network?: string;
  routerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin?: string;
  amountBMin?: string;
  to?: string;
  deadline?: string | number;
}

export interface RemoveLiquidityV2Params {
  network?: string;
  routerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenA: string;
  tokenB: string;
  liquidity: string;
  amountAMin?: string;
  amountBMin?: string;
  to?: string;
  deadline?: string | number;
}

export async function addLiquidityV2(params: AddLiquidityV2Params): Promise<unknown> {
  const network = params.network || "mainnet";

  const amountADesired = params.amountADesired;
  const amountBDesired = params.amountBDesired;

  const amountAMin = params.amountAMin ?? 0;
  const amountBMin = params.amountBMin ?? 0;

  const to =
    params.to ??
    await getWalletAddress({
      network,
      provider: params.provider,
    });

  const deadline =
    params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60; // +30 minutes

  // Ensure tokenA/tokenB approvals to the V2 router are sufficient.
  await ensureTokenAllowance({
    network,
    tokenAddress: params.tokenA,
    spender: params.routerAddress,
    requiredAmount: params.amountADesired,
    provider: params.provider,
  });

  await ensureTokenAllowance({
    network,
    tokenAddress: params.tokenB,
    spender: params.routerAddress,
    requiredAmount: amountBDesired,
    provider: params.provider,
  });

  const args = [
    params.tokenA,
    params.tokenB,
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    to,
    deadline,
  ];

  return sendContractTx({
    address: params.routerAddress,
    functionName: "addLiquidity",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });
}

export async function removeLiquidityV2(params: RemoveLiquidityV2Params): Promise<unknown> {
  const network = params.network || "mainnet";

  const amountAMin = params.amountAMin ?? "0";
  const amountBMin = params.amountBMin ?? "0";

  const to =
    params.to ??
    await getWalletAddress({
      network,
      provider: params.provider,
    });

  const deadline =
    params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60; // +30 minutes

  // For V2 remove, the "input token" is the LP token itself. The caller should
  // pass the LP token address as `tokenA` when building the MCP tool input.
  await ensureTokenAllowance({
    network,
    tokenAddress: params.tokenA,
    spender: params.routerAddress,
    requiredAmount: params.liquidity,
    provider: params.provider,
  });

  const args = [
    params.tokenA,
    params.tokenB,
    params.liquidity,
    amountAMin,
    amountBMin,
    to,
    deadline,
  ];

  return sendContractTx({
    address: params.routerAddress,
    functionName: "removeLiquidity",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });
}

