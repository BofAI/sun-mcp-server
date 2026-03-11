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
import { isLocalWalletConfigured } from "../src/sunswap/wallet";

const NETWORK = "nile";

// 需要替换为你的实际测试代币地址（Nile 测试网）
const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"; // USDT on Nile
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK"; // Another token
const FEE = 500;

/** 替换为你实际持有的 V4 position tokenId */
const TOKEN_ID = "56";

async function main() {
  if (!isLocalWalletConfigured()) {
    console.error("Error: No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC in .env");
    process.exit(1);
  }

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
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
    });

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
