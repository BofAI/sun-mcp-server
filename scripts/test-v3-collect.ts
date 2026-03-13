#!/usr/bin/env npx ts-node
/**
 * Local test for V3 Collect Fees (estimate + collect).
 *
 * Before running, configure .env in the project root:
 *   TRON_PRIVATE_KEY=your_hex_private_key
 *
 * Run: npx ts-node scripts/test-v3-collect.ts
 */

import "dotenv/config";
import { SunKit } from "@bankofai/sun-kit";
import { SUNSWAP_V3_NILE_POSITION_MANAGER } from "@bankofai/sun-kit";
import { initWallet, getWallet, isWalletConfigured } from "../src/wallet";

const NETWORK = "nile";
const PM = SUNSWAP_V3_NILE_POSITION_MANAGER;

/** Replace with the V3 position tokenId you actually own */
const TOKEN_ID = "519";

async function main() {
  await initWallet();
  if (!isWalletConfigured()) {
    console.error("Error: No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC in .env");
    process.exit(1);
  }
  const wallet = getWallet();
  const kit = new SunKit({ wallet, network: NETWORK });

  console.log("=== V3 Collect Fees Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("positionManager:", PM);
  console.log("tokenId:", TOKEN_ID);
  console.log("");

  try {
    const result = await kit.collectPositionV3({
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
  } catch (err: any) {
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);
    if (err?.stack) console.error("Stack:\n", err.stack);
    process.exit(1);
  }
}

main();
