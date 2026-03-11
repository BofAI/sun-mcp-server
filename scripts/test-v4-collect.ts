#!/usr/bin/env npx ts-node
/**
 * 本地测试 V4 Collect Fees（领取手续费）。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v4-collect.ts
 */

import "dotenv/config";
import {
  collectPositionV4,
  getCLPositionManagerAddress,
  getV4PositionInfo,
} from "../src/sunswap/positionsV4";

const NETWORK = "nile";

/** 替换为你实际持有的 V4 position tokenId */
const TOKEN_ID = "1";

async function main() {
  const PM = getCLPositionManagerAddress(NETWORK);

  console.log("=== V4 Collect Fees Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("CLPositionManager:", PM);
  console.log("tokenId:", TOKEN_ID);
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

  // 2) Collect fees
  console.log("--- Step 2: Collect fees ---");
  try {
    const result = await collectPositionV4({
      network: NETWORK,
      positionManagerAddress: PM,
      tokenId: TOKEN_ID,
    });

    console.log("Estimated fees:");
    console.log("  amount0:", result.estimatedFees.amount0);
    console.log("  amount1:", result.estimatedFees.amount1);
    console.log("");
    console.log("Collect tx result:");
    console.log(JSON.stringify(result.txResult, null, 2));
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    if (error?.stack) console.error("Stack:\n", error.stack);
    process.exit(1);
  }
}

main();
