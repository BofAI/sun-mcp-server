#!/usr/bin/env npx ts-node
/**
 * 本地测试 V3 Decrease Liquidity（自动 amountMin 计算）。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v3-decrease.ts
 */

import "dotenv/config";
import { decreaseLiquidityV3 } from "../src/sunswap/positionsV3";
import { SUNSWAP_V3_NILE_POSITION_MANAGER } from "../src/sunswap/constants";

const NETWORK = "nile";
const PM = SUNSWAP_V3_NILE_POSITION_MANAGER;
const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK";
const FEE = 3000;

/** 替换为你实际持有的 position tokenId */
const TOKEN_ID = "519";
/** 要移除的 liquidity 数量 */
const LIQUIDITY = "168860193549162";

async function main() {
  console.log("=== V3 Decrease Liquidity Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("positionManager:", PM);
  console.log("tokenId:", TOKEN_ID);
  console.log("liquidity:", LIQUIDITY);
  console.log("token0:", TOKEN_0, "token1:", TOKEN_1, "fee:", FEE);
  console.log("");

  try {
    const result = await decreaseLiquidityV3({
      network: NETWORK,
      positionManagerAddress: PM,
      tokenId: TOKEN_ID,
      liquidity: LIQUIDITY,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      // amount0Min / amount1Min omitted → auto-computed from V3 math + 5% slippage
    });

    console.log("Decrease result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);
    if (err?.stack) console.error("Stack:\n", err.stack);
    process.exit(1);
  }
}

main();
