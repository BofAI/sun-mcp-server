#!/usr/bin/env npx ts-node
/**
 * Local test for V2 remove-liquidity with detailed error output for debugging.
 *
 * Before running, configure .env in the project root, for example:
 *   TRON_PRIVATE_KEY=your_hex_private_key
 * or TRON_MNEMONIC=your_mnemonic_phrase
 *
 * Run: npx ts-node scripts/test-remove-liquidity.ts
 * or:  npm run script:test-remove-liquidity
 */

import "dotenv/config";
import { SunKit, SUNSWAP_V2_NILE_ROUTER } from "@bankofai/sun-kit";
import { initWallet, getWallet, isWalletConfigured } from "../src/wallet";

const NETWORK = "nile";
const ROUTER = SUNSWAP_V2_NILE_ROUTER;
const TOKEN_A = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const TOKEN_B = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
/** LP token amount (raw, 18 decimals by default; adjust to your actual position) */
const LIQUIDITY = "209776338";

async function main() {
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("TRON_MNEMONIC set:", !!process.env.TRON_MNEMONIC);
  console.log("network:", NETWORK, "router:", ROUTER);
  console.log("tokenA:", TOKEN_A, "tokenB:", TOKEN_B);
  console.log("liquidity (LP raw):", LIQUIDITY);
  console.log("");

  await initWallet();
  if (!isWalletConfigured()) {
    console.error("No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC.");
    process.exit(1);
  }

  const kit = new SunKit({ wallet: getWallet(), network: NETWORK });

  try {
    const result = await kit.removeLiquidityV2({
      network: NETWORK,
      routerAddress: ROUTER,
      tokenA: TOKEN_A,
      tokenB: TOKEN_B,
      liquidity: LIQUIDITY,
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
