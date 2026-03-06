#!/usr/bin/env npx ts-node
/**
 * 本地测试 V2 添加流动性，输出详细错误，便于排查 HTTP 500。
 *
 * 使用前请在项目根目录配置 .env，例如：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 * 或 TRON_MNEMONIC=助记词
 *
 * 运行：npx ts-node scripts/test-add-liquidity.ts
 * 或： npm run build && node -e "require('./dist/src/sunswap/liquidityV2').addLiquidityV2(...).then(console.log).catch(console.error)"
 */

import "dotenv/config";
import { addLiquidityV2 } from "../src/sunswap/liquidityV2";
import { SUNSWAP_V2_NILE_ROUTER } from "../src/sunswap/constants";

const NETWORK = "nile";
const ROUTER = SUNSWAP_V2_NILE_ROUTER;
const TOKEN_A = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const TOKEN_B = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK";
const AMOUNT_A = "1000000";
const AMOUNT_B = "25789306162807226";

async function main() {
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("TRON_MNEMONIC set:", !!process.env.TRON_MNEMONIC);
  console.log("network:", NETWORK, "router:", ROUTER);
  console.log("tokenA:", TOKEN_A, "tokenB:", TOKEN_B);
  console.log("amountADesired:", AMOUNT_A, "amountBDesired:", AMOUNT_B);
  console.log("");

  try {
    const result = await addLiquidityV2({
      network: NETWORK,
      routerAddress: ROUTER,
      tokenA: TOKEN_A,
      tokenB: TOKEN_B,
      amountADesired: AMOUNT_A,
      amountBDesired: AMOUNT_B,
    });
    console.log("Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);
    console.error("Full error:", err);
    if (err?.stack) console.error("Stack:\n", err.stack);
    if (err?.cause) console.error("Cause:", err.cause);
    process.exit(1);
  }
}

main();
