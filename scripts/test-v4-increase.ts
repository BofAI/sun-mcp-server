#!/usr/bin/env npx ts-node
/**
 * 本地测试 V4 Increase Liquidity（追加流动性）。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v4-increase.ts
 */

import "dotenv/config";
import {
  increaseLiquidityV4,
  getCLPositionManagerAddress,
  getV4PositionInfo,
} from "../src/sunswap/positionsV4";

const NETWORK = "nile";

// 需要替换为你的实际测试代币地址（Nile 测试网）
const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"; // USDT on Nile
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK"; // Another token
const FEE = 500;

/** 替换为你实际持有的 V4 position tokenId */
const TOKEN_ID = "1";

async function main() {
  const PM = getCLPositionManagerAddress(NETWORK);

  console.log("=== V4 Increase Liquidity Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("CLPositionManager:", PM);
  console.log("tokenId:", TOKEN_ID);
  console.log("token0:", TOKEN_0, "token1:", TOKEN_1, "fee:", FEE);
  console.log("");

  // 1) Read position info first (optional)
  console.log("--- Step 1: Read position info ---");
  try {
    const posInfo = await getV4PositionInfo(NETWORK, PM, TOKEN_ID);
    if (posInfo) {
      console.log("Position info:");
      console.log(JSON.stringify(posInfo, null, 2));
    } else {
      console.log("Position not found or not readable");
    }
  } catch (err) {
    console.log("Could not read position info:", (err as Error).message);
  }
  console.log("");

  // 2) Increase liquidity
  console.log("--- Step 2: Increase liquidity ---");
  try {
    const result = await increaseLiquidityV4({
      network: NETWORK,
      positionManagerAddress: PM,
      tokenId: TOKEN_ID,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      // tickLower / tickUpper omitted → read from position
      amount0Desired: "5000000", // only token0
      // amount1Desired omitted → auto-computed
    });

    console.log("Increase result:");
    console.log(JSON.stringify(result, null, 2));
    console.log("");
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
