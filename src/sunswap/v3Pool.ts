/**
 * Read V3 pool info from on-chain factory + pool contracts.
 */

import { getReadonlyTronWeb } from "./contracts";
import { SUNSWAP_V3_MAINNET_FACTORY, SUNSWAP_V3_NILE_FACTORY } from "./constants";

const V3_FACTORY_MIN_ABI = [
  {
    constant: true,
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    name: "getPool",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const V3_POOL_MIN_ABI = [
  {
    constant: true,
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "liquidity",
    outputs: [{ name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "tickSpacing",
    outputs: [{ name: "", type: "int24" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface V3PoolInfo {
  poolAddress: string;
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  tickSpacing: number;
}

function getV3FactoryAddress(network: string): string {
  const n = network.toLowerCase();
  if (n === "mainnet" || n === "tron" || n === "trx") return SUNSWAP_V3_MAINNET_FACTORY;
  if (n === "nile" || n === "testnet") return SUNSWAP_V3_NILE_FACTORY;
  throw new Error(`Unsupported network for SUNSWAP V3 factory: ${network}`);
}

export async function getV3PoolInfo(
  network: string,
  token0: string,
  token1: string,
  fee: number,
): Promise<V3PoolInfo | null> {
  const tronWeb = await getReadonlyTronWeb(network);
  const factoryAddress = getV3FactoryAddress(network);

  const factory = await tronWeb.contract(V3_FACTORY_MIN_ABI as any, factoryAddress);
  const poolHex = await factory.getPool(token0, token1, fee).call();
  const poolBase58 = tronWeb.address.fromHex(poolHex);

  const zeroBase58 = tronWeb.address.fromHex("410000000000000000000000000000000000000000");
  if (!poolBase58 || poolBase58 === zeroBase58) return null;

  const pool = await tronWeb.contract(V3_POOL_MIN_ABI as any, poolBase58);
  const s0 = await pool.slot0().call();
  const liq = await pool.liquidity().call();
  const ts = await pool.tickSpacing().call();

  return {
    poolAddress: poolBase58,
    sqrtPriceX96: (s0.sqrtPriceX96 ?? s0[0]).toString(),
    tick: Number(s0.tick ?? s0[1]),
    liquidity: liq.toString(),
    tickSpacing: Number(ts),
  };
}
