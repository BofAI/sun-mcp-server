/**
 * SUNSWAP V4 concentrated liquidity position management.
 *
 * Uses modifyLiquidities(bytes payload, uint256 deadline) to interact with
 * CLPositionManager. Payload is built via ActionsPlanner from @sun-protocol/universal-router-sdk V4.
 *
 * Uses Permit2 for token approvals - safer than direct approve/transfer.
 *
 * Reference: sun-frontend/packages/core/src/entities/position/adapters/PositionManagerV4.ts
 */

import { encodeFunctionData } from "viem";
import { V4 } from "@sun-protocol/universal-router-sdk";
import { zeroAddress } from "viem";
import { AllowanceTransfer, type PermitSingle } from "@sun-protocol/permit2-sdk";
import { sendContractTx, getReadonlyTronWeb } from "./contracts";
import { getWallet, getWalletAddress } from "../wallet";
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
  PERMIT2_MAINNET,
  PERMIT2_NILE,
} from "./constants";

const PLACEHOLDER_ADDRESS = "T000000000000000000000000000000000000";
const DEFAULT_TICK_RANGE_FACTOR = 100;
const ZERO_HEX_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export function getCLPositionManagerAddress(network: string): string {
  const n = network.toLowerCase();
  if (n === "mainnet" || n === "tron" || n === "trx")
    return SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER;
  if (n === "nile" || n === "testnet") return SUNSWAP_V4_NILE_CL_POSITION_MANAGER;
  throw new Error(`Unsupported network for SUNSWAP V4 CLPositionManager: ${network}`);
}

export function getPoolManagerAddress(network: string): string {
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
function toEvmHex(tronWeb: { address: { toHex: (a: string) => string } }, addr: string): `0x${string}` {
  if (!addr || addr === TRX_ADDRESS) return ZERO_HEX_ADDRESS;
  const hex = tronWeb.address.toHex(addr);
  const body = (hex.startsWith("41") ? hex.slice(2) : hex.replace(/^0x/, "")).slice(-40);
  return (`0x` + body) as `0x${string}`;
}

/** Build EncodedPoolKey for action params (parameters: Bytes32). */
async function buildEncodedPoolKey(
  tronWeb: { address: { toHex: (a: string) => string } },
  token0: string,
  token1: string,
  fee: number,
  tickSpacing: number,
  hooks: `0x${string}` = ZERO_HEX_ADDRESS,
): Promise<V4.EncodedPoolKey> {
  const currency0 = toEvmHex(tronWeb, token0);
  const currency1 = toEvmHex(tronWeb, token1);
  const parameters = V4.encodePoolParameters({ tickSpacing }) as `0x${string}`;
  return { currency0, currency1, hooks, fee, parameters };
}

/** Build PoolKey for getPoolId (parameters: { tickSpacing }). */
async function buildPoolKey(
  tronWeb: { address: { toHex: (a: string) => string } },
  token0: string,
  token1: string,
  fee: number,
  tickSpacing: number,
  hooks: `0x${string}` = ZERO_HEX_ADDRESS,
): Promise<V4.PoolKey> {
  const currency0 = toEvmHex(tronWeb, token0);
  const currency1 = toEvmHex(tronWeb, token1);
  return { currency0, currency1, hooks, fee, parameters: { tickSpacing } };
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
    hooks: poolKey.hooks ?? ZERO_HEX_ADDRESS,
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

  const sqrtPriceX96 = BigInt(decoded.sqrtPriceX96 ?? decoded[0] ?? 0);
  if (sqrtPriceX96 === 0n) {
    throw new Error("Pool not initialized (sqrtPriceX96 = 0)");
  }

  return {
    sqrtPriceX96,
    tick: Number(decoded.tick ?? decoded[1] ?? 0),
  };
}

/** Sort token pair so that token0 < token1 by hex address. */
async function sortTokenPair(
  tokenA: string,
  tokenB: string,
  network: string,
): Promise<[string, string, boolean]> {
  const tronWeb = await getReadonlyTronWeb(network);
  const hexA = toEvmHex(tronWeb, tokenA).toLowerCase();
  const hexB = toEvmHex(tronWeb, tokenB).toLowerCase();
  if (hexA <= hexB) return [tokenA, tokenB, false];
  return [tokenB, tokenA, true];
}

/** Apply slippage to get max amount (amount * (100 + slippage) / 100). */
function toAmountMax(amount: bigint, slippagePercent?: number): bigint {
  if (slippagePercent && slippagePercent > 0) {
    return (amount * BigInt(Math.floor((100 + slippagePercent) * 100))) / 10000n;
  }
  return amount;
}

/** Apply slippage to get min amount (amount * (100 - slippage) / 100). */
function toAmountMin(amount: bigint, slippagePercent?: number): bigint {
  if (slippagePercent && slippagePercent > 0) {
    return (amount * BigInt(Math.floor((100 - slippagePercent) * 100))) / 10000n;
  }
  return amount;
}

/** Sleep for specified milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Delay after approval to avoid same-block issues (in milliseconds). */
const APPROVAL_DELAY_MS = 3000;

/** Get Permit2 contract address for the network. */
export function getPermit2Address(network: string): string {
  const n = network.toLowerCase();
  if (n === "mainnet" || n === "tron" || n === "trx") return PERMIT2_MAINNET;
  if (n === "nile" || n === "testnet") return PERMIT2_NILE;
  throw new Error(`Unsupported network for Permit2: ${network}`);
}

/** Permit2 signature with details. */
interface Permit2Signature extends PermitSingle {
  signature: `0x${string}`;
}

/** Encode permit2 call for CLPositionManager multicall. */
function encodePermit2Call(owner: `0x${string}`, permit2Signature: Permit2Signature): `0x${string}` {
  const { signature, details, spender, sigDeadline } = permit2Signature;
  const permitSingle = {
    details: {
      token: details.token as `0x${string}`,
      amount: BigInt(details.amount),
      expiration: Number(details.expiration),
      nonce: Number(details.nonce),
    },
    spender: spender as `0x${string}`,
    sigDeadline: BigInt(sigDeadline),
  };

  return encodeFunctionData({
    abi: V4.Permit2ForwardAbi,
    functionName: "permit",
    args: [owner, permitSingle, signature],
  });
}

/** Approve token to Permit2 if needed. */
async function approveToPermit2(
  network: string,
  tokenAddress: string,
  amount: bigint,
): Promise<void> {
  const wallet = getWallet();
  const tronWeb = await wallet.getTronWeb(network);
  const walletAddress = await wallet.getAddress();
  const permit2Address = getPermit2Address(network);

  // Check current allowance
  const result = await tronWeb.transactionBuilder.triggerConstantContract(
    tokenAddress,
    "allowance(address,address)",
    {},
    [
      { type: "address", value: walletAddress },
      { type: "address", value: permit2Address },
    ],
  );

  const currentAllowance = result?.constant_result?.[0]
    ? BigInt("0x" + result.constant_result[0])
    : 0n;

  if (currentAllowance >= amount) {
    return; // Already approved
  }

  // Approve max uint256 to Permit2 (one-time approval)
  const maxUint256 = 2n ** 256n - 1n;
  const approveTx = await tronWeb.transactionBuilder.triggerSmartContract(
    tokenAddress,
    "approve(address,uint256)",
    { feeLimit: 100_000_000, callValue: 0 },
    [
      { type: "address", value: permit2Address },
      { type: "uint256", value: maxUint256.toString() },
    ],
  );

  const signed = await wallet.signAndBroadcast(approveTx as unknown as Record<string, unknown>, network);
  if (!signed.result) {
    throw new Error("Failed to approve token to Permit2");
  }

  // Wait for approval to be confirmed
  await sleep(APPROVAL_DELAY_MS);
}

/** Generate Permit2 signature for a token. */
async function generatePermit2Signature(
  network: string,
  tokenAddress: string,
  amount: bigint,
  spender: string,
): Promise<Permit2Signature> {
  const wallet = getWallet();
  const tronWeb = await wallet.getTronWeb(network);
  const walletAddress = await wallet.getAddress();
  const permit2Address = getPermit2Address(network);
  const testnet = network.toLowerCase() === "nile" || network.toLowerCase() === "testnet";

  const permit2 = new AllowanceTransfer(tronWeb as never, permit2Address, testnet);

  const now = Math.floor(Date.now() / 1000);
  const deadline = (now + 3600).toString(); // 1 hour expiration
  const sigDeadline = (now + 3600).toString();

  const { domain, permitSingle } = await permit2.generatePermitSignData(
    {
      owner: walletAddress,
      token: tokenAddress,
      amount,
      deadline,
    },
    spender,
    sigDeadline,
  );

  const PERMIT_TYPES = {
    PermitSingle: [
      { name: "details", type: "PermitDetails" },
      { name: "spender", type: "address" },
      { name: "sigDeadline", type: "uint256" },
    ],
    PermitDetails: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  };

  const rawSig = await wallet.signTypedData("PermitSingle", domain, PERMIT_TYPES, permitSingle as unknown as Record<string, unknown>);
  const signature = `0x${rawSig}` as `0x${string}`;

  return {
    ...permitSingle,
    signature,
  } as Permit2Signature;
}

/** Calculate tick from sqrtPriceX96 (approximate). */
function sqrtPriceX96ToTick(sqrtPriceX96: bigint): number {
  // tick = log_{1.0001}(price) = log_{1.0001}((sqrtPriceX96 / 2^96)^2)
  // = 2 * log_{1.0001}(sqrtPriceX96 / 2^96)
  // Using approximation: log_{1.0001}(x) ≈ ln(x) / ln(1.0001)
  const Q96 = 2n ** 96n;
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  if (sqrtPrice <= 0) return 0;
  const price = sqrtPrice * sqrtPrice;
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  return tick;
}

/** Encode and send modifyLiquidities tx via multicall. */
async function callMulticall(
  address: string,
  calls: `0x${string}`[],
  callValue: number,
  network: string,
): Promise<unknown> {
  const abi = V4.CLPositionManagerAbi as unknown as { type: string; name: string; inputs: unknown[] }[];
  return sendContractTx({
    address,
    functionName: "multicall",
    args: [calls],
    abi,
    network,
    value: callValue > 0 ? callValue.toString() : undefined,
  });
}

// ─── Mint Position ────────────────────────────────────────────────────

export interface MintPositionV4Params {
  network?: string;
  positionManagerAddress?: string;

  token0: string;
  token1: string;
  fee?: number;
  tickLower?: number;
  tickUpper?: number;
  amount0Desired?: string;
  amount1Desired?: string;
  slippage?: number;
  recipient?: string;
  deadline?: string | number;
  hookData?: string;

  /** Initial sqrtPriceX96 for pool creation. If pool doesn't exist and this is provided, the pool will be created first. */
  sqrtPriceX96?: string;
  /** If true, automatically create pool if it doesn't exist (requires sqrtPriceX96). */
  createPoolIfNeeded?: boolean;
}

export async function mintPositionV4(params: MintPositionV4Params): Promise<{
  txResult: unknown;
  computedAmounts?: { amount0Desired: string; amount1Desired: string };
  computedTicks?: { tickLower: number; tickUpper: number };
  poolCreated?: boolean;
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

  let slot0: { sqrtPriceX96: bigint; tick: number } | null = null;
  let poolCreated = false;
  let initializePoolCall: `0x${string}` | null = null;

  try {
    slot0 = await getV4Slot0(network, poolKey);
  } catch {
    // Pool doesn't exist or not initialized
    if (params.createPoolIfNeeded && params.sqrtPriceX96) {
      // Will create pool - encode the initializePool call
      const initialSqrtPriceX96 = BigInt(params.sqrtPriceX96);
      initializePoolCall = encodeFunctionData({
        abi: V4.CLPositionManagerAbi,
        functionName: "initializePool",
        args: [encodedPoolKey, initialSqrtPriceX96],
      });
      poolCreated = true;

      // Calculate tick from sqrtPriceX96 for position range
      const tick = sqrtPriceX96ToTick(initialSqrtPriceX96);
      slot0 = { sqrtPriceX96: initialSqrtPriceX96, tick };
    } else if (params.sqrtPriceX96) {
      // sqrtPriceX96 provided but createPoolIfNeeded not set - still create pool
      const initialSqrtPriceX96 = BigInt(params.sqrtPriceX96);
      initializePoolCall = encodeFunctionData({
        abi: V4.CLPositionManagerAbi,
        functionName: "initializePool",
        args: [encodedPoolKey, initialSqrtPriceX96],
      });
      poolCreated = true;

      const tick = sqrtPriceX96ToTick(initialSqrtPriceX96);
      slot0 = { sqrtPriceX96: initialSqrtPriceX96, tick };
    } else {
      throw new Error(
        `V4 pool not found or not initialized for ${token0}/${token1} fee=${fee}. ` +
        `Provide sqrtPriceX96 to create a new pool.`
      );
    }
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

  // User input amounts (user's perspective)
  const userAmount0 = params.amount0Desired ? BigInt(params.amount0Desired) : 0n;
  const userAmount1 = params.amount1Desired ? BigInt(params.amount1Desired) : 0n;

  // Convert to pool perspective (sorted token0, token1)
  let amount0 = swapped ? userAmount1 : userAmount0;
  let amount1 = swapped ? userAmount0 : userAmount1;

  let computedAmounts: { amount0Desired: string; amount1Desired: string } | undefined;

  // Calculate the other amount if only one is provided
  if (amount0 > 0n && amount1 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount0 * 1000000n);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount1 = amts.amount1 > 0n ? amts.amount1 : 1n;
    computedAmounts = { amount0Desired: amount0.toString(), amount1Desired: amount1.toString() };
  } else if (amount1 > 0n && amount0 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount1 * 1000000n, amount1);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount0 = amts.amount0 > 0n ? amts.amount0 : 1n;
    computedAmounts = { amount0Desired: amount0.toString(), amount1Desired: amount1.toString() };
  }

  if (amount0 === 0n && amount1 === 0n) {
    throw new Error("At least one of amount0Desired / amount1Desired must be > 0");
  }

  // Calculate liquidity
  const liquidity = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount1);

  // Apply slippage for max amounts
  const amount0Max = toAmountMax(amount0, params.slippage);
  const amount1Max = toAmountMax(amount1, params.slippage);

  const recipient = params.recipient ?? (await getWalletAddress());
  const recipientEvm = toEvmHex(tronWeb, recipient);
  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60);
  const hookData = (params.hookData ?? "0x") as `0x${string}`;

  // Get owner address for Permit2
  const ownerAddress = await getWalletAddress();
  const ownerEvm = toEvmHex(tronWeb, ownerAddress);

  // Permit2 flow: approve tokens to Permit2, then generate signatures
  const permit2Calls: `0x${string}`[] = [];

  if (encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS) {
    // Approve token0 to Permit2
    await approveToPermit2(network, token0, amount0Max);

    // Generate Permit2 signature for CLPositionManager
    const permit2Sig0 = await generatePermit2Signature(
      network,
      token0,
      amount0Max,
      address,
    );
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig0));
  }

  if (encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS) {
    // Approve token1 to Permit2
    await approveToPermit2(network, token1, amount1Max);

    // Generate Permit2 signature for CLPositionManager
    const permit2Sig1 = await generatePermit2Signature(
      network,
      token1,
      amount1Max,
      address,
    );
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig1));
  }

  // Build modifyLiquidities call
  const planner = new V4.ActionsPlanner();

  const encodedPositionConfig: V4.EncodedCLPositionConfig = {
    poolKey: encodedPoolKey,
    tickLower,
    tickUpper,
  };

  planner.add(V4.ACTIONS.CL_MINT_POSITION, [
    encodedPositionConfig,
    liquidity,
    amount0Max,
    amount1Max,
    recipientEvm,
    hookData,
  ]);

  // SETTLE: payerIsUser = true for non-native tokens (Permit2 will pull from user)
  // payerIsUser = false for native TRX (will be sent as callValue)
  const OPEN_DELTA = V4.ACTION_CONSTANTS.OPEN_DELTA;
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency0,
    OPEN_DELTA,
    encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS, // payerIsUser = true for tokens
  ]);
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency1,
    OPEN_DELTA,
    encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS, // payerIsUser = true for tokens
  ]);

  // SWEEP: return excess native currency
  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency0, recipientEvm]);
  }
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency1, recipientEvm]);
  }

  const payload = planner.encode();

  // Encode modifyLiquidities call
  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: "modifyLiquidities",
    args: [payload, deadline],
  });

  let callValue = 0;
  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) callValue += Number(amount0Max);
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) callValue += Number(amount1Max);

  // Build multicall: [permit2 calls..., initializePool (if needed), modifyLiquidities]
  const calls: `0x${string}`[] = [];

  // Add Permit2 signature calls first
  console.log(`[mintPositionV4] permit2Calls count: ${permit2Calls.length}`);
  calls.push(...permit2Calls);

  // Add initializePool if needed
  if (initializePoolCall) {
    console.log(`[mintPositionV4] Adding initializePool call`);
    calls.push(initializePoolCall);
  }

  // Add modifyLiquidities
  calls.push(modifyLiquiditiesCall);

  console.log(`[mintPositionV4] Total multicall count: ${calls.length}`);
  const txResult = await callMulticall(address, calls, callValue, network);

  const computedTicks =
    params.tickLower == null || params.tickUpper == null ? { tickLower, tickUpper } : undefined;

  // Swap back computed amounts to user's perspective
  if (computedAmounts && swapped) {
    computedAmounts = {
      amount0Desired: computedAmounts.amount1Desired,
      amount1Desired: computedAmounts.amount0Desired,
    };
  }

  return { txResult, computedAmounts, computedTicks, poolCreated };
}

// ─── Increase Liquidity ──────────────────────────────────────────────

export interface IncreaseLiquidityV4Params {
  network?: string;
  positionManagerAddress?: string;

  tokenId: string;
  token0?: string;
  token1?: string;
  fee?: number;
  tickLower?: number;
  tickUpper?: number;
  amount0Desired?: string;
  amount1Desired?: string;
  slippage?: number;
  deadline?: string | number;
  hookData?: string;
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

  // Read position tick range if not provided
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

  // User input amounts
  const userAmount0 = params.amount0Desired ? BigInt(params.amount0Desired) : 0n;
  const userAmount1 = params.amount1Desired ? BigInt(params.amount1Desired) : 0n;

  // Convert to pool perspective
  let amount0 = swapped ? userAmount1 : userAmount0;
  let amount1 = swapped ? userAmount0 : userAmount1;

  // Calculate the other amount if only one is provided
  if (amount0 > 0n && amount1 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount0 * 1000000n);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount1 = amts.amount1 > 0n ? amts.amount1 : 1n;
  } else if (amount1 > 0n && amount0 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount1 * 1000000n, amount1);
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq);
    amount0 = amts.amount0 > 0n ? amts.amount0 : 1n;
  }

  if (amount0 === 0n && amount1 === 0n) {
    throw new Error("At least one of amount0Desired / amount1Desired must be > 0");
  }

  // Calculate liquidity
  const liquidity = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount1);

  const amount0Max = toAmountMax(amount0, params.slippage);
  const amount1Max = toAmountMax(amount1, params.slippage);

  const ownerAddress = await getWalletAddress();
  const ownerEvm = toEvmHex(tronWeb, ownerAddress);
  const recipientEvm = ownerEvm;
  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60);
  const hookData = (params.hookData ?? "0x") as `0x${string}`;

  // Permit2 flow: approve tokens to Permit2, then generate signatures
  const permit2Calls: `0x${string}`[] = [];

  if (encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS) {
    await approveToPermit2(network, token0, amount0Max);
    const permit2Sig0 = await generatePermit2Signature(
      network,
      token0,
      amount0Max,
      address,
    );
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig0));
  }

  if (encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS) {
    await approveToPermit2(network, token1, amount1Max);
    const permit2Sig1 = await generatePermit2Signature(
      network,
      token1,
      amount1Max,
      address,
    );
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig1));
  }

  // Build modifyLiquidities call
  const planner = new V4.ActionsPlanner();

  // CL_INCREASE_LIQUIDITY: [tokenId, liquidity, amount0Max, amount1Max, hookData]
  planner.add(V4.ACTIONS.CL_INCREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    liquidity,
    amount0Max,
    amount1Max,
    hookData,
  ]);

  // SETTLE with payerIsUser = true for non-native tokens (Permit2 will pull from user)
  const OPEN_DELTA = V4.ACTION_CONSTANTS.OPEN_DELTA;
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency0,
    OPEN_DELTA,
    encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS,
  ]);
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency1,
    OPEN_DELTA,
    encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS,
  ]);

  // SWEEP for native currency
  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency0, recipientEvm]);
  }
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency1, recipientEvm]);
  }

  const payload = planner.encode();

  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: "modifyLiquidities",
    args: [payload, deadline],
  });

  let callValue = 0;
  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) callValue += Number(amount0Max);
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) callValue += Number(amount1Max);

  // Build multicall: [permit2 calls..., modifyLiquidities]
  const calls: `0x${string}`[] = [];
  calls.push(...permit2Calls);
  calls.push(modifyLiquiditiesCall);

  const txResult = await callMulticall(address, calls, callValue, network);

  let computedAmounts: { amount0Desired: string; amount1Desired: string } = {
    amount0Desired: amount0.toString(),
    amount1Desired: amount1.toString(),
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

  tokenId: string;
  liquidity: string;
  token0?: string;
  token1?: string;
  fee?: number;
  amount0Min?: string;
  amount1Min?: string;
  slippage?: number;
  deadline?: string | number;
  hookData?: string;
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
  const encodedPoolKey = await buildEncodedPoolKey(tronWeb, token0, token1, fee, tickSpacing);

  const liquidity = BigInt(params.liquidity);
  const amount0Min = toAmountMin(BigInt(params.amount0Min ?? "0"), params.slippage);
  const amount1Min = toAmountMin(BigInt(params.amount1Min ?? "0"), params.slippage);

  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60);
  const hookData = (params.hookData ?? "0x") as `0x${string}`;

  // Build modifyLiquidities call using CLOSE_CURRENCY
  const planner = new V4.ActionsPlanner();

  // CL_DECREASE_LIQUIDITY: [tokenId, liquidity, amount0Min, amount1Min, hookData]
  planner.add(V4.ACTIONS.CL_DECREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    liquidity,
    amount0Min,
    amount1Min,
    hookData,
  ]);

  // Use CLOSE_CURRENCY to collect the withdrawn tokens
  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency0]);
  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency1]);

  const payload = planner.encode();

  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: "modifyLiquidities",
    args: [payload, deadline],
  });

  const txResult = await callMulticall(address, [modifyLiquiditiesCall], 0, network);

  return {
    txResult,
    computedAmountMin: {
      amount0Min: amount0Min.toString(),
      amount1Min: amount1Min.toString(),
    },
  };
}

// ─── Collect Fees ─────────────────────────────────────────────────────

export interface CollectPositionV4Params {
  network?: string;
  positionManagerAddress?: string;

  tokenId: string;
  token0?: string;
  token1?: string;
  fee?: number;
  deadline?: string | number;
  hookData?: string;
}

export async function collectPositionV4(
  params: CollectPositionV4Params,
): Promise<{ txResult: unknown }> {
  const network = params.network || "mainnet";
  const address = params.positionManagerAddress ?? getCLPositionManagerAddress(network);
  ensureV4Deployed(address, "CLPositionManager");

  const tronWeb = await getReadonlyTronWeb(network);

  // Read position info to get poolKey
  const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, address);
  const pos = await ((pm as unknown) as { positions: (id: string) => { call: () => Promise<unknown> } })
    .positions(params.tokenId)
    .call();
  const posArr = Array.isArray(pos) ? pos : [pos];
  const poolKeyObj = (pos as { poolKey?: unknown }).poolKey ?? posArr[0];
  const poolKeyArr = Array.isArray(poolKeyObj) ? poolKeyObj : [poolKeyObj];

  let currency0: `0x${string}`;
  let currency1: `0x${string}`;
  let fee: number;
  let tickSpacing: number;

  if (params.token0 && params.token1) {
    const [token0, token1] = await sortTokenPair(params.token0, params.token1, network);
    currency0 = toEvmHex(tronWeb, token0);
    currency1 = toEvmHex(tronWeb, token1);
    fee = params.fee ?? 500;
    tickSpacing = FEE_TICK_SPACING[fee] ?? 10;
  } else {
    // Parse from position
    const poolKeyObjTyped = poolKeyObj as { currency0?: string; currency1?: string; fee?: number; parameters?: string };
    currency0 = (poolKeyObjTyped?.currency0 ?? poolKeyArr[0] ?? ZERO_HEX_ADDRESS) as `0x${string}`;
    currency1 = (poolKeyObjTyped?.currency1 ?? poolKeyArr[1] ?? ZERO_HEX_ADDRESS) as `0x${string}`;
    fee = Number(poolKeyObjTyped?.fee ?? poolKeyArr[3] ?? 500);
    tickSpacing = FEE_TICK_SPACING[fee] ?? 10;
  }

  const encodedPoolKey: V4.EncodedPoolKey = {
    currency0,
    currency1,
    hooks: ZERO_HEX_ADDRESS,
    fee,
    parameters: V4.encodePoolParameters({ tickSpacing }) as `0x${string}`,
  };

  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60);
  const hookData = (params.hookData ?? "0x") as `0x${string}`;

  // Collect fees by calling CL_DECREASE_LIQUIDITY with liquidity=0
  const planner = new V4.ActionsPlanner();

  planner.add(V4.ACTIONS.CL_DECREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    0n,
    0n,
    0n,
    hookData,
  ]);

  // Use CLOSE_CURRENCY to collect the fees
  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency0]);
  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency1]);

  const payload = planner.encode();

  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: "modifyLiquidities",
    args: [payload, deadline],
  });

  const txResult = await callMulticall(address, [modifyLiquiditiesCall], 0, network);

  return { txResult };
}

// ─── Read Helpers ─────────────────────────────────────────────────────

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

// ─── Price Helpers ────────────────────────────────────────────────────

/**
 * Calculate sqrtPriceX96 from a price ratio.
 * sqrtPriceX96 = sqrt(price) * 2^96
 *
 * @param price - The price ratio (token1/token0)
 * @returns sqrtPriceX96 as string
 *
 * @example
 * // Price = 1 (1:1 ratio)
 * priceToSqrtPriceX96(1) // "79228162514264337593543950336"
 *
 * // Price = 0.0001 (e.g., 1 WBTC = 10000 USDT, so USDT/WBTC = 0.0001)
 * priceToSqrtPriceX96(0.0001) // "792281625142643375935439503"
 */
export function priceToSqrtPriceX96(price: number): string {
  if (price <= 0) throw new Error("Price must be positive");
  const Q96 = 2n ** 96n;
  const sqrtPrice = Math.sqrt(price);
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));
  return sqrtPriceX96.toString();
}

/**
 * Calculate price from sqrtPriceX96.
 * price = (sqrtPriceX96 / 2^96)^2
 *
 * @param sqrtPriceX96 - The sqrtPriceX96 value
 * @returns price ratio (token1/token0)
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: string | bigint): number {
  const Q96 = 2n ** 96n;
  const sqrtPriceX96Bn = typeof sqrtPriceX96 === "string" ? BigInt(sqrtPriceX96) : sqrtPriceX96;
  const sqrtPrice = Number(sqrtPriceX96Bn) / Number(Q96);
  return sqrtPrice * sqrtPrice;
}

/**
 * Calculate sqrtPriceX96 from token amounts for initial pool creation.
 * Useful when you want to set the initial price based on the amounts you're providing.
 *
 * @param amount0 - Amount of token0
 * @param amount1 - Amount of token1
 * @param decimals0 - Decimals of token0 (default: 6)
 * @param decimals1 - Decimals of token1 (default: 6)
 * @returns sqrtPriceX96 as string
 */
export function amountsToSqrtPriceX96(
  amount0: string | bigint,
  amount1: string | bigint,
  decimals0 = 6,
  decimals1 = 6,
): string {
  const amt0 = typeof amount0 === "string" ? BigInt(amount0) : amount0;
  const amt1 = typeof amount1 === "string" ? BigInt(amount1) : amount1;

  if (amt0 === 0n) throw new Error("amount0 must be positive");

  // Adjust for decimals: price = (amount1 / 10^decimals1) / (amount0 / 10^decimals0)
  const decimalAdjustment = 10 ** (decimals1 - decimals0);
  const price = (Number(amt1) / Number(amt0)) * decimalAdjustment;

  return priceToSqrtPriceX96(price);
}
