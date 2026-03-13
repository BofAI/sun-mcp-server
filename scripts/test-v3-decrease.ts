#!/usr/bin/env npx ts-node
/**
 * Local test for V3 Decrease Liquidity (auto amountMin calculation).
 *
 * Before running, configure .env in the project root:
 *   TRON_PRIVATE_KEY=your_hex_private_key
 *
 * Run: npx ts-node scripts/test-v3-decrease.ts
 */

import "dotenv/config";
import { SunKit } from "@bankofai/sun-kit";
import { SUNSWAP_V3_NILE_POSITION_MANAGER } from "@bankofai/sun-kit";
import { initWallet, getWallet, isWalletConfigured } from "../src/wallet";

const NETWORK = "nile";
const PM = SUNSWAP_V3_NILE_POSITION_MANAGER;
const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK";
const FEE = 3000;

/** Replace with the V3 position tokenId you actually own */
const TOKEN_ID = "519";
/** Amount of liquidity to remove */
const LIQUIDITY = "71781681482149";

async function main() {
  await initWallet();
  if (!isWalletConfigured()) {
    console.error("Error: No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC in .env");
    process.exit(1);
  }
  const wallet = getWallet();
  const kit = new SunKit({ wallet, network: NETWORK });

  console.log("=== V3 Decrease Liquidity Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("positionManager:", PM);
  console.log("tokenId:", TOKEN_ID);
  console.log("liquidity:", LIQUIDITY);
  console.log("token0:", TOKEN_0, "token1:", TOKEN_1, "fee:", FEE);
  console.log("");

  try {
    const result = await kit.decreaseLiquidityV3({
      network: NETWORK,
      positionManagerAddress: PM,
      tokenId: TOKEN_ID,
      liquidity: LIQUIDITY,
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
