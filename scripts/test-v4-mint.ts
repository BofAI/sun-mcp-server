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
import { SunKit } from "@bankofai/sun-kit";
import { initWallet, getWallet, isWalletConfigured } from "../src/wallet";

const NETWORK = "nile";

const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK";
const FEE = 500;
const SLIPPAGE = 0.5; // 0.5%
const INITIAL_PRICE = 1;
const INITIAL_SQRT_PRICE_X96 = SunKit.priceToSqrtPriceX96(INITIAL_PRICE);

async function main() {
  await initWallet();
  if (!isWalletConfigured()) {
    console.error("Error: No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC in .env");
    process.exit(1);
  }
  const wallet = getWallet();
  const kit = new SunKit({ wallet, network: NETWORK });

  const PM = SunKit.getCLPositionManagerAddress(NETWORK);
  const POOL_MANAGER = SunKit.getPoolManagerAddress(NETWORK);

  console.log("=== V4 Mint Position Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("CLPositionManager:", PM);
  console.log("PoolManager:", POOL_MANAGER);
  console.log("token0 (input):", TOKEN_0);
  console.log("token1 (input):", TOKEN_1);
  console.log("fee:", FEE);
  console.log("");

  console.log("--- Mint (single-sided: amount0Desired only, auto ticks, auto create pool) ---");
  console.log("Initial sqrtPriceX96 for new pool:", INITIAL_SQRT_PRICE_X96);
  console.log("");

  try {
    const result = await kit.mintPositionV4({
      network: NETWORK,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      amount0Desired: "10000000",
      slippage: SLIPPAGE,
      sqrtPriceX96: INITIAL_SQRT_PRICE_X96,
      createPoolIfNeeded: true,
    });

    console.log("Mint result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    if (error?.stack) console.error("Stack:\n", error.stack);
    process.exit(1);
  }
}

main();
