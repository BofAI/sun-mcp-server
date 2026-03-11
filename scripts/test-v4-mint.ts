#!/usr/bin/env npx ts-node
/**
 * 本地测试 V4 Mint Position（自动 tickLower/Upper + 单边输入自动算另一边）。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v4-mint.ts
 */

import "dotenv/config";
import {
  mintPositionV4,
  getCLPositionManagerAddress,
  getPoolManagerAddress,
} from "../src/sunswap/positionsV4";
import { getReadonlyTronWeb } from "../src/sunswap/contracts";

const NETWORK = "nile";

// 需要替换为你的实际测试代币地址（Nile 测试网）
const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"; // USDT on Nile
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK"; // Another token
const FEE = 500;

async function main() {
  const PM = getCLPositionManagerAddress(NETWORK);
  const POOL_MANAGER = getPoolManagerAddress(NETWORK);

  console.log("=== V4 Mint Position Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("CLPositionManager:", PM);
  console.log("PoolManager:", POOL_MANAGER);
  console.log("token0 (input):", TOKEN_0);
  console.log("token1 (input):", TOKEN_1);
  console.log("fee:", FEE);
  console.log("");

  // Convert to EVM hex and show sorted order
  const tronWeb = await getReadonlyTronWeb(NETWORK);
  const hex0 = tronWeb.address.toHex(TOKEN_0).toLowerCase();
  const hex1 = tronWeb.address.toHex(TOKEN_1).toLowerCase();
  console.log("token0 hex:", hex0);
  console.log("token1 hex:", hex1);
  const sorted = hex0 <= hex1;
  console.log("tokens already sorted:", sorted);
  if (!sorted) {
    console.log("=> Will swap: token0 becomes", TOKEN_1, ", token1 becomes", TOKEN_0);
  }
  console.log("");

  console.log("--- Mint (single-sided: amount0Desired only, auto ticks) ---");
  try {
    const result = await mintPositionV4({
      network: NETWORK,
      positionManagerAddress: PM,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      // tickLower / tickUpper omitted → auto from currentTick ± 100*tickSpacing
      amount0Desired: "10000000", // only token0
      // amount1Desired omitted → auto-computed
    });
  
    console.log("Mint result:");
    console.log(JSON.stringify(result, null, 2));
    console.log("");
    if (result.computedTicks) {
      console.log("Computed ticks:", result.computedTicks);
    }
    if (result.computedAmounts) {
      console.log("Computed amounts:", result.computedAmounts);
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    if (error?.stack) console.error("Stack:\n", error.stack);
    process.exit(1);
  }
}

main();
