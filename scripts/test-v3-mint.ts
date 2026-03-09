#!/usr/bin/env npx ts-node
/**
 * 本地测试 V3 Mint Position（自动 tickLower/Upper + 单边输入自动算另一边）。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v3-mint.ts
 */

import "dotenv/config";
import { mintPositionV3 } from "../src/sunswap/positionsV3";
import { SUNSWAP_V3_NILE_POSITION_MANAGER } from "../src/sunswap/constants";
import { getV3PoolInfo } from "../src/sunswap/v3Pool";

const NETWORK = "nile";
const PM = SUNSWAP_V3_NILE_POSITION_MANAGER;
const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"; // USDT on Nile
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK"; // Another token
const FEE = 3000;

async function main() {
  console.log("=== V3 Mint Position Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("positionManager:", PM);
  console.log("token0:", TOKEN_0);
  console.log("token1:", TOKEN_1);
  console.log("fee:", FEE);
  console.log("");

  // 1) Read pool info first
  console.log("--- Step 1: Read pool info ---");
  const pool = await getV3PoolInfo(NETWORK, TOKEN_0, TOKEN_1, FEE);
  if (!pool) {
    console.error("Pool not found!");
    process.exit(1);
  }
  console.log("Pool address:", pool.poolAddress);
  console.log("sqrtPriceX96:", pool.sqrtPriceX96);
  console.log("currentTick:", pool.tick);
  console.log("tickSpacing:", pool.tickSpacing);
  console.log("liquidity:", pool.liquidity);
  console.log("");

  // 2) Mint with single-sided input + auto ticks
  console.log("--- Step 2: Mint (single-sided: amount0Desired only, auto ticks) ---");
  try {
    const result = await mintPositionV3({
      network: NETWORK,
      positionManagerAddress: PM,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      // tickLower / tickUpper omitted → auto from currentTick ± 50*tickSpacing
      amount0Desired: "1000000", // only token0
      // amount1Desired omitted → auto-computed
    });

    console.log("Mint result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);
    if (err?.stack) console.error("Stack:\n", err.stack);
    process.exit(1);
  }
}

main();
