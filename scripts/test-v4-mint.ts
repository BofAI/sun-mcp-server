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
  priceToSqrtPriceX96,
  sqrtPriceX96ToPrice,
} from "../src/sunswap/positionsV4";
import { getReadonlyTronWeb } from "../src/sunswap/contracts";
import { isLocalWalletConfigured } from "../src/sunswap/wallet";

const NETWORK = "nile";

// 需要替换为你的实际测试代币地址（Nile 测试网）
const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"; // USDT on Nile
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK"; // Another token
const FEE = 500;
const SLIPPAGE = 0.5; // 0.5%

// 如果池子不存在，使用这个初始价格创建池子
// price = token1 / token0 的比率
const INITIAL_PRICE = 1; // 1:1 比率
const INITIAL_SQRT_PRICE_X96 = priceToSqrtPriceX96(INITIAL_PRICE);

async function main() {
  if (!isLocalWalletConfigured()) {
    console.error("Error: No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC in .env");
    process.exit(1);
  }

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

  console.log("--- Mint (single-sided: amount0Desired only, auto ticks, auto create pool) ---");
  console.log("Initial sqrtPriceX96 for new pool:", INITIAL_SQRT_PRICE_X96);
  console.log("");

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
      slippage: SLIPPAGE,
      // 如果池子不存在，使用这个初始价格创建池子
      sqrtPriceX96: INITIAL_SQRT_PRICE_X96,
      createPoolIfNeeded: true,
    });
  
    console.log("Mint result:");
    console.log(JSON.stringify(result, null, 2));
    console.log("");
    if (result.poolCreated) {
      console.log("Pool was created with initial sqrtPriceX96:", INITIAL_SQRT_PRICE_X96);
    }
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
