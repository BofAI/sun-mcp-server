/**
 * SUNSWAP V4 concentrated liquidity position management.
 *
 * Uses modifyLiquidities(bytes payload, uint256 deadline) to interact with
 * CLPositionManager. Payload is built via ActionsPlanner from @sun-protocol/universal-router-sdk V4.
 */

import { encodeFunctionData } from "viem";
import { V4 } from "@sun-protocol/universal-router-sdk";
import { zeroAddress } from "viem";
import { sendContractTx, transferTokenTo, getReadonlyTronWeb } from "./contracts";
import type { AgentWalletProvider } from "./wallet";
import { getWalletAddress } from "./wallet";
import {
  getSqrtRatioAtTick,
  maxLiquidityForAmounts,
  getAmountsForLiquidity,
  nearestUsableTick,
  FEE_TICK_SPACING,
} from "./v3Math";
import {
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
  TRX_ADDRESS,
} from "./constants";

const PLACEHOLDER_ADDRESS = "T000000000000000000000000000000000000";
const DEFAULT_TICK_RANGE_FACTOR = 100;

function getCLPositionManagerAddress(network: string): string {
  const n = network.toLowerCase();
  if (n === "mainnet" || n === "tron" || n === "trx")
    return SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER;
  if (n === "nile" || n === "testnet") return SUNSWAP_V4_NILE_CL_POSITION_MANAGER;
  throw new Error(`Unsupported network for SUNSWAP V4 CLPositionManager: ${network}`);
}

function getPoolManagerAddress(network: string): string {
  const n = network.toLowerCase();
  if (n === "mainnet" || n === "tron" || n === "trx") return SUNSWAP_V4_MAINNET_POOL_MANAGER;
  if (n === "nile" || n === "testnet") return SUNSWAP_V4_NILE_POOL_MANAGER;
  throw new Error(`Unsupported network for SUNSWAP V4 PoolManager: ${network}`);
}

function ensureV4Deployed(address: string, label: string): void {
  if (!address || address === PLACEHOLDER_ADDRESS) {
    throw new Error(
      `SUNSWAP V4 ${label} not deployed. Set SUNSWAP_V4_*_${label.toUpperCase().replace(/ /g, "_")} in constants.ts.`,
    );
  }
}

/** Convert TRON base58 address to EVM hex (0x + 40 chars). Use zeroAddress for native TRX. */
async function toEvmHex(tronWeb: { address: { toHex: (a: string) => string } }, addr: string): Promise<`0x${string}`> {
  if (!addr || addr === TRX_ADDRESS) return zeroAddress as `0x${string}`;
  const hex = tronWeb.address.toHex(addr);
  const body = (hex.startsWith("41") ? hex.slice(2) : hex.replace(/^0x/, "")).slice(-40);
  return (`0x` + body) as `0x${string}`;
}

/** Build PoolKey for getPoolId and finalize (parameters: { tickSpacing }). */
async function buildPoolKey(
  tronWeb: { address: { toHex: (a: string) => string } },
  token0: string,
  token1: string,
  fee: number,
  tickSpacing: number,
  hooks: `0x${string}` = zeroAddress as `0x${string}`,
): Promise<V4.PoolKey> {
  const currency0 = await toEvmHex(tronWeb, token0);
  const currency1 = await toEvmHex(tronWeb, token1);
  return { currency0, currency1, hooks, fee, parameters: { tickSpacing } };
}

/** Build EncodedPoolKey for action params (parameters: Bytes32). */
async function buildEncodedPoolKey(
  tronWeb: { address: { toHex: (a: string) => string } },
  token0: string,
  token1: string,
  fee: number,
  tickSpacing: number,
  hooks: `0x${string}` = zeroAddress as `0x${string}`,
): Promise<V4.EncodedPoolKey> {
  const currency0 = await toEvmHex(tronWeb, token0);
  const currency1 = await toEvmHex(tronWeb, token1);
  const parameters = V4.encodePoolParameters({ tickSpacing }) as `0x${string}`;
  return { currency0, currency1, hooks, fee, parameters };
}

/** Read slot0 (sqrtPriceX96, tick) from V4 PoolManager. */
async function getV4Slot0(
  network: string,
  poolKey: V4.PoolKey,
): Promise<{ sqrtPriceX96: bigint; tick: number }> {
  const poolManagerAddr = getPoolManagerAddress(network);
  ensureV4Deployed(poolManagerAddr, "PoolManager");

  const poolId = V4.getPoolId({
    ...poolKey,
    hooks: poolKey.hooks ?? (zeroAddress as `0x${string}`),
  });

  const tronWeb = await getReadonlyTronWeb(network);
  const result = await tronWeb.transactionBuilder.triggerConstantContract(
    poolManagerAddr,
    "getSlot0(bytes32)",
    {},
    [{ type: "bytes32", value: poolId }],
  );

  if (!result?.constant_result?.[0]) throw new Error("getSlot0 returned no data");

  const hex = "0x" + result.constant_result[0];
  const decoded = tronWeb.utils.abi.decodeParams(
    ["sqrtPriceX96", "tick", "protocolFee", "lpFee"],
    ["uint160", "int24", "uint24", "uint24"],
    hex,
    true,
  );

  return {
    sqrtPriceX96: BigInt(decoded.sqrtPriceX96 ?? decoded[0] ?? 0),
    tick: Number(decoded.tick ?? decoded[1] ?? 0),
  };
}

async function sortTokenPair(
  tokenA: string,
  tokenB: string,
  network: string,
): Promise<[string, string, boolean]> {
  const tronWeb = await getReadonlyTronWeb(network);
  const hexA = tronWeb.address.toHex(tokenA).toLowerCase();
  const hexB = tronWeb.address.toHex(tokenB).toLowerCase();
  if (hexA <= hexB) return [tokenA, tokenB, false];
  return [tokenB, tokenA, true];
}

/** Encode and send modifyLiquidities tx. */
async function callModifyLiquidities(
  address: string,
  payload: `0x${string}`,
  deadline: bigint,
  callValue: number,
  network: string,
  provider?: AgentWalletProvider,
): Promise<unknown> {
  const abi = V4.CLPositionManagerAbi as unknown as { type: string; name: string; inputs: unknown[] }[];
  const args = [payload, deadline];
  return sendContractTx({
    address,
    functionName: "modifyLiquidities",
    args,
    abi,
    network,
    provider,
    value: callValue > 0 ? callValue.toString() : undefined,
  });
}

// ─── Mint ────────────────────────────────────────────────────────────

export interface MintPositionV4Params {
  network?: string;
  positionManagerAddress?: string;
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

export async function mintPositionV4(params: MintPositionV4Params): Promise<{
  txResult: unknown;
  computedAmounts?: { amount0Desired: string; amount1Desired: string };
  computedTicks?: { tickLower: number; tickUpper: number };
}> {
  const network = params.network || "mainnet";
  const fee = params.fee ?? 500;
  const address = params.positionManagerAddress ?? getCLPositionManagerAddress(network);
  ensureV4Deployed(address, "CLPositionManager");

  const [token0, token1, swapped] = await sortTokenPair(params.token0, params.token1, network);
  const tickSpacing = FEE_TICK_SPACING[fee] ?? 10;

  const tronWeb = await getReadonlyTronWeb(network);
  const poolKey = await buildPoolKey(tronWeb, token0, token1, fee, tickSpacing);
  const encodedPoolKey = await buildEncodedPoolKey(tronWeb, token0, token1, fee, tickSpacing);

  let slot0: { sqrtPriceX96: bigint; tick: number };
  try {
    slot0 = await getV4Slot0(network, poolKey);
  } catch {
    throw new Error(`V4 pool not found or not initialized for ${token0}/${token1} fee=${fee}`);
  }

  const currentTick = slot0.tick;
  const sqrtPriceX96 = slot0.sqrtPriceX96;

  const tickLower =
    params.tickLower ??
    nearestUsableTick(currentTick - DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing);
  const tickUpper =
    params.tickUpper ??
    nearestUsableTick(currentTick + DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing);

  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);

  // User input amounts (user's perspective: params.token0, params.token1)
  const userAmount0 = params.amount0Desired ? BigInt(params.amount0Desired) : 0n;
  const userAmount1 = params.amount1Desired ? BigInt(params.amount1Desired) : 0n;

  // Convert to pool perspective (sorted token0, token1)
  let amount0Desired = swapped ? userAmount1 : userAmount0;
  let amount1Desired = swapped ? userAmount0 : userAmount1;

  const inRange = sqrtPriceX96 > sqrtA && sqrtPriceX96 < sqrtB;
  let computedAmounts: { amount0Desired: string; amount1Desired: string } | undefined;

  // Calculate the other amount based on the provided one
  if (amount0Desired > 0n && amount1Desired === 0n) {
    // User provided pool's token0 amount, calculate token1
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0Desired, amount0Desired * 1000000n);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount1Desired = amts.amount1;
    if (inRange && amount1Desired === 0n) amount1Desired = 1n;
    // Store computed amounts in pool perspective
    computedAmounts = { amount0Desired: amount0Desired.toString(), amount1Desired: amount1Desired.toString() };
  } else if (amount1Desired > 0n && amount0Desired === 0n) {
    // User provided pool's token1 amount, calculate token0
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount1Desired * 1000000n, amount1Desired);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount0Desired = amts.amount0;
    if (inRange && amount0Desired === 0n) amount0Desired = 1n;
    // Store computed amounts in pool perspective
    computedAmounts = { amount0Desired: amount0Desired.toString(), amount1Desired: amount1Desired.toString() };
  }

  if (amount0Desired === 0n && amount1Desired === 0n) {
    throw new Error("At least one of amount0Desired / amount1Desired must be > 0");
  }

  const amount0Max = amount0Desired;
  const amount1Max = amount1Desired;

  const recipient =
    params.recipient ?? (await getWalletAddress({ network, provider: params.provider }));
  const recipientEvm = (await toEvmHex(tronWeb, recipient)) as `0x${string}`;
  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60);

  // Transfer tokens to CLPositionManager (like reference implementation)
  // Skip for native TRX (will be sent as callValue)
  if (encodedPoolKey.currency0 !== zeroAddress) {
    await transferTokenTo({
      network,
      tokenAddress: token0,
      to: address,
      amount: amount0Max.toString(),
      provider: params.provider,
    });
  }
  if (encodedPoolKey.currency1 !== zeroAddress) {
    await transferTokenTo({
      network,
      tokenAddress: token1,
      to: address,
      amount: amount1Max.toString(),
      provider: params.provider,
    });
  }

  const encodedPositionConfig: V4.EncodedCLPositionConfig = {
    poolKey: encodedPoolKey,
    tickLower,
    tickUpper,
  };

  const liquidity = maxLiquidityForAmounts(
    sqrtPriceX96,
    sqrtA,
    sqrtB,
    amount0Max,
    amount1Max,
  );

  const planner = new V4.ActionsPlanner();
  planner.add(V4.ACTIONS.CL_MINT_POSITION, [
    encodedPositionConfig,
    liquidity,
    amount0Max,
    amount1Max,
    recipientEvm,
    "0x" as `0x${string}`,
  ]);

  // Use SETTLE with OPEN_DELTA and payerIsUser=false (pay from contract balance, tokens already transferred)
  const OPEN_DELTA = V4.ACTION_CONSTANTS.OPEN_DELTA;
  planner.add(V4.ACTIONS.SETTLE, [encodedPoolKey.currency0, OPEN_DELTA, false]);
  planner.add(V4.ACTIONS.SETTLE, [encodedPoolKey.currency1, OPEN_DELTA, false]);

  // SWEEP native currency if needed
  if (encodedPoolKey.currency0 === zeroAddress) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency0, recipientEvm]);
  }
  if (encodedPoolKey.currency1 === zeroAddress) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency1, recipientEvm]);
  }

  const payload = planner.encode();

  let callValue = 0;
  if (encodedPoolKey.currency0 === zeroAddress) callValue += Number(amount0Max);
  if (encodedPoolKey.currency1 === zeroAddress) callValue += Number(amount1Max);

  const txResult = await callModifyLiquidities(
    address,
    payload,
    deadline,
    callValue,
    network,
    params.provider,
  );

  const computedTicks =
    params.tickLower == null || params.tickUpper == null ? { tickLower, tickUpper } : undefined;

  if (computedAmounts && swapped) {
    computedAmounts = {
      amount0Desired: computedAmounts.amount1Desired,
      amount1Desired: computedAmounts.amount0Desired,
    };
  }

  return { txResult, computedAmounts, computedTicks };
}

// ─── Increase Liquidity ──────────────────────────────────────────────

export interface IncreaseLiquidityV4Params {
  network?: string;
  positionManagerAddress?: string;
  provider?: AgentWalletProvider;

  tokenId: string;
  token0?: string;
  token1?: string;
  fee?: number;
  tickLower?: number;
  tickUpper?: number;
  amount0Desired?: string;
  amount1Desired?: string;
  amount0Min?: string;
  amount1Min?: string;
  deadline?: string | number;
}

export async function increaseLiquidityV4(
  params: IncreaseLiquidityV4Params,
): Promise<{ txResult: unknown; computedAmounts?: { amount0Desired: string; amount1Desired: string } }> {
  const network = params.network || "mainnet";
  const address = params.positionManagerAddress ?? getCLPositionManagerAddress(network);
  ensureV4Deployed(address, "CLPositionManager");

  if (!params.token0 || !params.token1) {
    throw new Error("token0 and token1 are required for increaseLiquidityV4");
  }

  const [token0, token1, swapped] = await sortTokenPair(params.token0, params.token1, network);
  const fee = params.fee ?? 500;
  const tickSpacing = FEE_TICK_SPACING[fee] ?? 10;

  const tronWeb = await getReadonlyTronWeb(network);
  const poolKey = await buildPoolKey(tronWeb, token0, token1, fee, tickSpacing);
  const encodedPoolKey = await buildEncodedPoolKey(tronWeb, token0, token1, fee, tickSpacing);

  let slot0: { sqrtPriceX96: bigint; tick: number };
  try {
    slot0 = await getV4Slot0(network, poolKey);
  } catch {
    throw new Error(`V4 pool not found for ${token0}/${token1} fee=${fee}`);
  }

  const sqrtPriceX96 = slot0.sqrtPriceX96;
  let tickLower = params.tickLower;
  let tickUpper = params.tickUpper;

  if (tickLower == null || tickUpper == null) {
    const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, address);
    const pos = await ((pm as unknown) as { positions: (id: string) => { call: () => Promise<unknown> } })
      .positions(params.tokenId)
      .call();
    const posArr = Array.isArray(pos) ? pos : [pos];
    const posObj = pos as { tickLower?: unknown; tickUpper?: unknown };
    tickLower = tickLower ?? Number(posObj.tickLower ?? posArr[1]);
    tickUpper = tickUpper ?? Number(posObj.tickUpper ?? posArr[2]);
  }

  const sqrtA = getSqrtRatioAtTick(tickLower!);
  const sqrtB = getSqrtRatioAtTick(tickUpper!);

  // User input amounts (user's perspective: params.token0, params.token1)
  const userAmount0 = params.amount0Desired ? BigInt(params.amount0Desired) : 0n;
  const userAmount1 = params.amount1Desired ? BigInt(params.amount1Desired) : 0n;

  // Convert to pool perspective (sorted token0, token1)
  let amount0Desired = swapped ? userAmount1 : userAmount0;
  let amount1Desired = swapped ? userAmount0 : userAmount1;

  const inRange = sqrtPriceX96 > sqrtA && sqrtPriceX96 < sqrtB;

  // Calculate the other amount based on the provided one
  if (amount0Desired > 0n && amount1Desired === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0Desired, amount0Desired * 1000000n);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount1Desired = amts.amount1;
    if (inRange && amount1Desired === 0n) amount1Desired = 1n;
  } else if (amount1Desired > 0n && amount0Desired === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount1Desired * 1000000n, amount1Desired);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount0Desired = amts.amount0;
    if (inRange && amount0Desired === 0n) amount0Desired = 1n;
  }

  if (amount0Desired === 0n && amount1Desired === 0n) {
    throw new Error("At least one of amount0Desired / amount1Desired must be > 0");
  }

  const amount0Max = amount0Desired;
  const amount1Max = amount1Desired;

  const recipient = await getWalletAddress({ network, provider: params.provider });
  const recipientEvm = (await toEvmHex(tronWeb, recipient)) as `0x${string}`;
  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60);

  // Transfer tokens to CLPositionManager (like reference implementation)
  // Skip for native TRX (will be sent as callValue)
  if (encodedPoolKey.currency0 !== zeroAddress) {
    await transferTokenTo({
      network,
      tokenAddress: token0,
      to: address,
      amount: amount0Max.toString(),
      provider: params.provider,
    });
  }
  if (encodedPoolKey.currency1 !== zeroAddress) {
    await transferTokenTo({
      network,
      tokenAddress: token1,
      to: address,
      amount: amount1Max.toString(),
      provider: params.provider,
    });
  }

  const encodedPositionConfig: V4.EncodedCLPositionConfig = {
    poolKey: encodedPoolKey,
    tickLower: tickLower!,
    tickUpper: tickUpper!,
  };

  const liquidity = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0Max, amount1Max);

  const planner = new V4.ActionsPlanner();
  (planner.add as (a: number, p: unknown[]) => void)(V4.ACTIONS.CL_INCREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    liquidity,
    amount0Max,
    amount1Max,
    "0x" as `0x${string}`,
    encodedPositionConfig,
  ]);

  // Use SETTLE with OPEN_DELTA and payerIsUser=false (pay from contract balance, tokens already transferred)
  const OPEN_DELTA = V4.ACTION_CONSTANTS.OPEN_DELTA;
  planner.add(V4.ACTIONS.SETTLE, [encodedPoolKey.currency0, OPEN_DELTA, false]);
  planner.add(V4.ACTIONS.SETTLE, [encodedPoolKey.currency1, OPEN_DELTA, false]);

  // SWEEP native currency if needed
  if (encodedPoolKey.currency0 === zeroAddress) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency0, recipientEvm]);
  }
  if (encodedPoolKey.currency1 === zeroAddress) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency1, recipientEvm]);
  }

  const payload = planner.encode();

  let callValue = 0;
  if (encodedPoolKey.currency0 === zeroAddress) callValue += Number(amount0Max);
  if (encodedPoolKey.currency1 === zeroAddress) callValue += Number(amount1Max);

  const txResult = await callModifyLiquidities(
    address,
    payload,
    deadline,
    callValue,
    network,
    params.provider,
  );

  let computedAmounts: { amount0Desired: string; amount1Desired: string } = {
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
  };
  if (swapped) {
    computedAmounts = {
      amount0Desired: computedAmounts.amount1Desired,
      amount1Desired: computedAmounts.amount0Desired,
    };
  }

  return { txResult, computedAmounts };
}

// ─── Decrease Liquidity ──────────────────────────────────────────────

export interface DecreaseLiquidityV4Params {
  network?: string;
  positionManagerAddress?: string;
  provider?: AgentWalletProvider;

  tokenId: string;
  liquidity: string;
  token0?: string;
  token1?: string;
  fee?: number;
  amount0Min?: string;
  amount1Min?: string;
  deadline?: string | number;
}

export async function decreaseLiquidityV4(
  params: DecreaseLiquidityV4Params,
): Promise<{
  txResult: unknown;
  computedAmountMin?: { amount0Min: string; amount1Min: string };
}> {
  const network = params.network || "mainnet";
  const address = params.positionManagerAddress ?? getCLPositionManagerAddress(network);
  ensureV4Deployed(address, "CLPositionManager");

  if (!params.token0 || !params.token1) {
    throw new Error("token0 and token1 are required for decreaseLiquidityV4");
  }

  const [token0, token1] = await sortTokenPair(params.token0, params.token1, network);
  const fee = params.fee ?? 500;
  const tickSpacing = FEE_TICK_SPACING[fee] ?? 10;

  const tronWeb = await getReadonlyTronWeb(network);
  const poolKey = await buildPoolKey(tronWeb, token0, token1, fee, tickSpacing);

  const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, address);
  const pos = await ((pm as unknown) as { positions: (id: string) => { call: () => Promise<unknown> } })
    .positions(params.tokenId)
    .call();
  const posArr = Array.isArray(pos) ? pos : [pos];
  const posObj = pos as { tickLower?: unknown; tickUpper?: unknown };
  const tickLower = Number(posObj.tickLower ?? posArr[1]);
  const tickUpper = Number(posObj.tickUpper ?? posArr[2]);

  const amount0Min = BigInt(params.amount0Min ?? "0");
  const amount1Min = BigInt(params.amount1Min ?? "0");
  const liquidity = BigInt(params.liquidity);

  const recipient = await getWalletAddress({ network, provider: params.provider });
  const recipientEvm = (await toEvmHex(tronWeb, recipient)) as `0x${string}`;
  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60);

  const planner = new V4.ActionsPlanner();
  planner.add(V4.ACTIONS.CL_DECREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    liquidity,
    amount0Min,
    amount1Min,
    "0x" as `0x${string}`,
  ]);
  const payload = planner.finalizeModifyLiquidityWithTakePair(poolKey, recipientEvm);

  const txResult = await callModifyLiquidities(address, payload, deadline, 0, network, params.provider);

  return {
    txResult,
    computedAmountMin: {
      amount0Min: amount0Min.toString(),
      amount1Min: amount1Min.toString(),
    },
  };
}

// ─── Collect (claim fees: increase with 0 liquidity + take) ───────────

export interface CollectPositionV4Params {
  network?: string;
  positionManagerAddress?: string;
  provider?: AgentWalletProvider;

  tokenId: string;
  recipient?: string;
}

export async function collectPositionV4(
  params: CollectPositionV4Params,
): Promise<{ estimatedFees: { amount0: string; amount1: string }; txResult: unknown }> {
  const network = params.network || "mainnet";
  const address = params.positionManagerAddress ?? getCLPositionManagerAddress(network);
  ensureV4Deployed(address, "CLPositionManager");

  const recipient =
    params.recipient ?? (await getWalletAddress({ network, provider: params.provider }));
  const tronWeb = await getReadonlyTronWeb(network);
  const recipientEvm = (await toEvmHex(tronWeb, recipient)) as `0x${string}`;

  const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, address);
  const pos = await ((pm as unknown) as { positions: (id: string) => { call: () => Promise<unknown> } })
    .positions(params.tokenId)
    .call();
  const posArr = Array.isArray(pos) ? pos : [pos];
  const poolKeyObj = (pos as { poolKey?: { currency0?: string; currency1?: string; fee?: number } }).poolKey ?? posArr[0];
  const currency0 = (poolKeyObj?.currency0 ?? posArr[0]?.currency0 ?? zeroAddress) as `0x${string}`;
  const currency1 = (poolKeyObj?.currency1 ?? posArr[0]?.currency1 ?? zeroAddress) as `0x${string}`;
  const fee = Number(poolKeyObj?.fee ?? posArr[0]?.fee ?? 500);
  const tickLower = Number((pos as { tickLower?: unknown }).tickLower ?? posArr[1] ?? 0);
  const tickUpper = Number((pos as { tickUpper?: unknown }).tickUpper ?? posArr[2] ?? 0);
  const tickSpacing = FEE_TICK_SPACING[fee] ?? 10;

  const poolKey: V4.PoolKey = {
    currency0,
    currency1,
    hooks: zeroAddress as `0x${string}`,
    fee,
    parameters: { tickSpacing },
  };
  const encodedPoolKey: V4.EncodedPoolKey = {
    currency0,
    currency1,
    hooks: zeroAddress as `0x${string}`,
    fee,
    parameters: V4.encodePoolParameters({ tickSpacing }) as `0x${string}`,
  };

  const planner = new V4.ActionsPlanner();
  (planner.add as (a: number, p: unknown[]) => void)(V4.ACTIONS.CL_INCREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    0n,
    BigInt("340282366920938463463374607431768211455"),
    BigInt("340282366920938463463374607431768211455"),
    "0x" as `0x${string}`,
    { poolKey: encodedPoolKey, tickLower, tickUpper },
  ]);
  const payload = planner.finalizeModifyLiquidityWithTakePair(poolKey, recipientEvm);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
  const txResult = await callModifyLiquidities(address, payload, deadline, 0, network, params.provider);

  return {
    estimatedFees: { amount0: "0", amount1: "0" },
    txResult,
  };
}

// ─── Read helpers ────────────────────────────────────────────────────

export async function getV4PositionInfo(
  network: string,
  positionManagerAddress: string,
  tokenId: string,
): Promise<{
  poolKey: { currency0: string; currency1: string; fee: number; tickSpacing: number };
  tickLower: number;
  tickUpper: number;
  liquidity: string;
} | null> {
  ensureV4Deployed(positionManagerAddress, "CLPositionManager");

  const tronWeb = await getReadonlyTronWeb(network);
  const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, positionManagerAddress);

  try {
    const result = await ((pm as unknown) as { getPoolAndPositionInfo: (id: string) => { call: () => Promise<unknown> } })
      .getPoolAndPositionInfo(tokenId)
      .call();

    const poolKey = (result as unknown[])[0] as {
      currency0?: string;
      currency1?: string;
      fee?: number;
      parameters?: string;
    };
    const info = (result as unknown[])[1] as { tickLower?: number; tickUpper?: number; liquidity?: string };

    return {
      poolKey: {
        currency0: poolKey?.currency0 ?? "",
        currency1: poolKey?.currency1 ?? "",
        fee: poolKey?.fee ?? 0,
        tickSpacing: 0,
      },
      tickLower: info?.tickLower ?? 0,
      tickUpper: info?.tickUpper ?? 0,
      liquidity: (info?.liquidity ?? "0").toString(),
    };
  } catch {
    return null;
  }
}

export { getCLPositionManagerAddress, getPoolManagerAddress };
