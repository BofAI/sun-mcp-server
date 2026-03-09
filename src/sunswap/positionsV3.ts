import { sendContractTx, ensureTokenAllowance, getReadonlyTronWeb } from "./contracts";
import type { AgentWalletProvider } from "./wallet";
import { getWalletAddress } from "./wallet";
import { getV3PoolInfo } from "./v3Pool";
import {
  getSqrtRatioAtTick,
  maxLiquidityForAmounts,
  getAmountsForLiquidity,
  nearestUsableTick,
  FEE_TICK_SPACING,
} from "./v3Math";

const MAX_UINT128 = "340282366920938463463374607431768211455"; // 2^128 - 1

const DEFAULT_SLIPPAGE_BPS = 500; // 5%
const DEFAULT_TICK_RANGE_FACTOR = 50; // ± 50 * tickSpacing

function applySlippage(amount: string): string {
  const raw = BigInt(amount || "0");
  if (raw === 0n) return "0";
  const factor = BigInt(10_000 - DEFAULT_SLIPPAGE_BPS);
  return ((raw * factor) / 10_000n).toString();
}

// ─── Mint ────────────────────────────────────────────────────────────

export interface MintPositionV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  token0: string;
  token1: string;
  fee?: number;
  tickLower?: number;
  tickUpper?: number;
  amount0Desired?: string;
  amount1Desired?: string;
  amount0Min?: string;
  amount1Min?: string;
  recipient?: string;
  deadline?: string | number;
}

/**
 * Auto-enriches mint params:
 * - If fee missing, defaults to 3000.
 * - If tickLower/tickUpper missing, reads currentTick from pool, sets ±50*tickSpacing.
 * - If only one of amount0Desired/amount1Desired is provided, computes the other
 *   using V3 math and current pool price (single-sided input).
 */
export async function mintPositionV3(params: MintPositionV3Params): Promise<{
  txResult: unknown;
  computedAmounts?: { amount0Desired: string; amount1Desired: string };
  computedTicks?: { tickLower: number; tickUpper: number };
}> {
  const network = params.network || "mainnet";
  const fee = params.fee ?? 3000;

  const poolInfo = await getV3PoolInfo(network, params.token0, params.token1, fee);
  if (!poolInfo)
    throw new Error(`V3 pool not found for ${params.token0}/${params.token1} fee=${fee}`);

  const tickSpacing = poolInfo.tickSpacing || FEE_TICK_SPACING[fee] || 60;
  const currentTick = poolInfo.tick;
  const sqrtPriceX96 = BigInt(poolInfo.sqrtPriceX96);

  const tickLower =
    params.tickLower ??
    nearestUsableTick(currentTick - DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing);
  const tickUpper =
    params.tickUpper ??
    nearestUsableTick(currentTick + DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing);

  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);

  let amount0Desired = params.amount0Desired ? BigInt(params.amount0Desired) : 0n;
  let amount1Desired = params.amount1Desired ? BigInt(params.amount1Desired) : 0n;

  let computedAmounts: { amount0Desired: string; amount1Desired: string } | undefined;

  if (amount0Desired > 0n && amount1Desired === 0n) {
    const liq = maxLiquidityForAmounts(
      sqrtPriceX96,
      sqrtA,
      sqrtB,
      amount0Desired,
      BigInt("999999999999999999999999999999"),
    );
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount1Desired = amts.amount1;
    computedAmounts = {
      amount0Desired: amount0Desired.toString(),
      amount1Desired: amount1Desired.toString(),
    };
  } else if (amount1Desired > 0n && amount0Desired === 0n) {
    const liq = maxLiquidityForAmounts(
      sqrtPriceX96,
      sqrtA,
      sqrtB,
      BigInt("999999999999999999999999999999"),
      amount1Desired,
    );
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount0Desired = amts.amount0;
    computedAmounts = {
      amount0Desired: amount0Desired.toString(),
      amount1Desired: amount1Desired.toString(),
    };
  }

  if (amount0Desired === 0n && amount1Desired === 0n) {
    throw new Error("At least one of amount0Desired / amount1Desired must be > 0");
  }

  const amount0Min = params.amount0Min ?? applySlippage(amount0Desired.toString());
  const amount1Min = params.amount1Min ?? applySlippage(amount1Desired.toString());

  const recipient =
    params.recipient ?? (await getWalletAddress({ network, provider: params.provider }));
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60;

  await ensureTokenAllowance({
    network,
    tokenAddress: params.token0,
    spender: params.positionManagerAddress,
    requiredAmount: amount0Desired.toString(),
    provider: params.provider,
  });
  await ensureTokenAllowance({
    network,
    tokenAddress: params.token1,
    spender: params.positionManagerAddress,
    requiredAmount: amount1Desired.toString(),
    provider: params.provider,
  });

  const args = [
    {
      token0: params.token0,
      token1: params.token1,
      fee,
      tickLower,
      tickUpper,
      amount0Desired: amount0Desired.toString(),
      amount1Desired: amount1Desired.toString(),
      amount0Min,
      amount1Min,
      recipient,
      deadline,
    },
  ];

  const txResult = await sendContractTx({
    address: params.positionManagerAddress,
    functionName: "mint",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });

  const computedTicks =
    params.tickLower === undefined ||
    params.tickLower === null ||
    params.tickUpper === undefined ||
    params.tickUpper === null
      ? { tickLower, tickUpper }
      : undefined;

  return { txResult, computedAmounts, computedTicks };
}

// ─── Increase Liquidity ──────────────────────────────────────────────

export interface IncreaseLiquidityV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenId: string;

  /**
   * Provide token0/token1/fee so the helper can read the pool and auto-compute.
   * If omitted, both amount0Desired AND amount1Desired must be provided.
   */
  token0?: string;
  token1?: string;
  fee?: number;

  /**
   * Optional tick overrides. If omitted, reads from the existing on-chain position.
   * Only used when single-sided auto-compute is triggered.
   */
  tickLower?: number;
  tickUpper?: number;

  amount0Desired?: string;
  amount1Desired?: string;
  amount0Min?: string;
  amount1Min?: string;
  deadline?: string | number;
}

export async function increaseLiquidityV3(params: IncreaseLiquidityV3Params): Promise<{
  txResult: unknown;
  computedAmounts?: { amount0Desired: string; amount1Desired: string };
}> {
  const network = params.network || "mainnet";

  let amount0Desired = params.amount0Desired ? BigInt(params.amount0Desired) : 0n;
  let amount1Desired = params.amount1Desired ? BigInt(params.amount1Desired) : 0n;

  let computedAmounts: { amount0Desired: string; amount1Desired: string } | undefined;

  const needAutoCompute =
    (amount0Desired > 0n && amount1Desired === 0n) ||
    (amount1Desired > 0n && amount0Desired === 0n);

  if (needAutoCompute) {
    if (!params.token0 || !params.token1) {
      throw new Error(
        "token0/token1/fee are required for single-sided auto-compute in increaseLiquidity",
      );
    }
    const fee = params.fee ?? 3000;
    const poolInfo = await getV3PoolInfo(network, params.token0, params.token1, fee);
    if (!poolInfo)
      throw new Error(`V3 pool not found for ${params.token0}/${params.token1} fee=${fee}`);

    let tickLower = params.tickLower;
    let tickUpper = params.tickUpper;

    if (
      tickLower === undefined ||
      tickLower === null ||
      tickUpper === undefined ||
      tickUpper === null
    ) {
      const tronWeb = await getReadonlyTronWeb(network);
      const pm = await tronWeb.contract().at(params.positionManagerAddress);
      const pos = await pm.positions(params.tokenId).call();
      tickLower = tickLower ?? Number(pos.tickLower ?? pos[5]);
      tickUpper = tickUpper ?? Number(pos.tickUpper ?? pos[6]);
    }

    const sqrtPriceX96 = BigInt(poolInfo.sqrtPriceX96);
    const sqrtA = getSqrtRatioAtTick(tickLower);
    const sqrtB = getSqrtRatioAtTick(tickUpper);

    if (amount0Desired > 0n && amount1Desired === 0n) {
      const liq = maxLiquidityForAmounts(
        sqrtPriceX96,
        sqrtA,
        sqrtB,
        amount0Desired,
        BigInt("999999999999999999999999999999"),
      );
      const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
      amount1Desired = amts.amount1;
    } else {
      const liq = maxLiquidityForAmounts(
        sqrtPriceX96,
        sqrtA,
        sqrtB,
        BigInt("999999999999999999999999999999"),
        amount1Desired,
      );
      const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
      amount0Desired = amts.amount0;
    }
    computedAmounts = {
      amount0Desired: amount0Desired.toString(),
      amount1Desired: amount1Desired.toString(),
    };
  }

  if (amount0Desired === 0n && amount1Desired === 0n) {
    throw new Error("At least one of amount0Desired / amount1Desired must be > 0");
  }

  const amount0Min = params.amount0Min ?? applySlippage(amount0Desired.toString());
  const amount1Min = params.amount1Min ?? applySlippage(amount1Desired.toString());
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60;

  if (params.token0) {
    await ensureTokenAllowance({
      network,
      tokenAddress: params.token0,
      spender: params.positionManagerAddress,
      requiredAmount: amount0Desired.toString(),
      provider: params.provider,
    });
  }
  if (params.token1) {
    await ensureTokenAllowance({
      network,
      tokenAddress: params.token1,
      spender: params.positionManagerAddress,
      requiredAmount: amount1Desired.toString(),
      provider: params.provider,
    });
  }

  const args = [
    {
      tokenId: params.tokenId,
      amount0Desired: amount0Desired.toString(),
      amount1Desired: amount1Desired.toString(),
      amount0Min,
      amount1Min,
      deadline,
    },
  ];

  const txResult = await sendContractTx({
    address: params.positionManagerAddress,
    functionName: "increaseLiquidity",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });

  return { txResult, computedAmounts };
}

// ─── Decrease Liquidity ──────────────────────────────────────────────

export interface DecreaseLiquidityV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenId: string;
  liquidity: string;

  /**
   * Provide token0/token1/fee so the helper can read pool and auto-compute amountMin.
   * If omitted, amount0Min/amount1Min default to "0".
   */
  token0?: string;
  token1?: string;
  fee?: number;

  amount0Min?: string;
  amount1Min?: string;
  deadline?: string | number;
}

export async function decreaseLiquidityV3(params: DecreaseLiquidityV3Params): Promise<{
  txResult: unknown;
  computedAmountMin?: { amount0Min: string; amount1Min: string };
}> {
  const network = params.network || "mainnet";
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60;

  let amount0Min = params.amount0Min;
  let amount1Min = params.amount1Min;
  let computedAmountMin: { amount0Min: string; amount1Min: string } | undefined;

  if (
    amount0Min === undefined ||
    amount0Min === null ||
    amount1Min === undefined ||
    amount1Min === null
  ) {
    try {
      const fee = params.fee ?? 3000;
      let token0 = params.token0;
      let token1 = params.token1;

      if (!token0 || !token1) {
        const tronWeb = await getReadonlyTronWeb(network);
        const pm = await tronWeb.contract().at(params.positionManagerAddress);
        const pos = await pm.positions(params.tokenId).call();
        token0 = token0 || (pos.token0 ?? tronWeb.address.fromHex(pos[2]));
        token1 = token1 || (pos.token1 ?? tronWeb.address.fromHex(pos[3]));
      }

      const poolInfo = await getV3PoolInfo(network, token0!, token1!, fee);
      if (poolInfo) {
        const tronWeb = await getReadonlyTronWeb(network);
        const pm = await tronWeb.contract().at(params.positionManagerAddress);
        const pos = await pm.positions(params.tokenId).call();
        const tickLower = Number(pos.tickLower ?? pos[5]);
        const tickUpper = Number(pos.tickUpper ?? pos[6]);

        const sqrtPriceX96 = BigInt(poolInfo.sqrtPriceX96);
        const sqrtA = getSqrtRatioAtTick(tickLower);
        const sqrtB = getSqrtRatioAtTick(tickUpper);

        const liquidityBn = BigInt(params.liquidity);
        const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liquidityBn);

        amount0Min = amount0Min ?? applySlippage(amts.amount0.toString());
        amount1Min = amount1Min ?? applySlippage(amts.amount1.toString());
        computedAmountMin = { amount0Min, amount1Min };
      }
    } catch {
      // fallback to "0" if pool read fails
    }
  }

  const args = [
    {
      tokenId: params.tokenId,
      liquidity: params.liquidity,
      amount0Min: amount0Min ?? "0",
      amount1Min: amount1Min ?? "0",
      deadline,
    },
  ];

  const txResult = await sendContractTx({
    address: params.positionManagerAddress,
    functionName: "decreaseLiquidity",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });

  return { txResult, computedAmountMin };
}

// ─── Collect ─────────────────────────────────────────────────────────

export interface CollectPositionV3Params {
  network?: string;
  positionManagerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenId: string;
  recipient?: string;
}

export async function collectPositionV3(
  params: CollectPositionV3Params,
): Promise<{ estimatedFees: { amount0: string; amount1: string }; txResult: unknown }> {
  const network = params.network || "mainnet";

  const ownerAddress = await getWalletAddress({
    network,
    provider: params.provider,
  });

  const recipient = params.recipient || ownerAddress;

  const tronWeb = await getReadonlyTronWeb(network);
  const pmView = params.abi
    ? await tronWeb.contract(params.abi, params.positionManagerAddress)
    : await tronWeb.contract().at(params.positionManagerAddress);

  const feesRaw = await (pmView as any)
    .collect([params.tokenId, ownerAddress, MAX_UINT128, MAX_UINT128])
    .call({ from: ownerAddress });

  const amount0 = (feesRaw.amount0 ?? feesRaw[0] ?? "0").toString();
  const amount1 = (feesRaw.amount1 ?? feesRaw[1] ?? "0").toString();
  const estimatedFees = { amount0, amount1 };

  const args = [
    {
      tokenId: params.tokenId,
      recipient,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    },
  ];

  const txResult = await sendContractTx({
    address: params.positionManagerAddress,
    functionName: "collect",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });

  return { estimatedFees, txResult };
}
