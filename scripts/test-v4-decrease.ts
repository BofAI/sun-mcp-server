#!/usr/bin/env npx ts-node
/**
 * Local test for V4 Decrease Liquidity (removing liquidity).
 *
 * Before running, configure .env in the project root:
 *   TRON_PRIVATE_KEY=your_hex_private_key
 *
 * Run: npx ts-node scripts/test-v4-decrease.ts
 */

import "dotenv/config";
import { SunKit } from "@bankofai/sun-kit";
import { initWallet, getWallet, isWalletConfigured } from "../src/wallet";

const NETWORK = "nile";

const TOKEN_0 = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const TOKEN_1 = "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK";
const FEE = 500;
const SLIPPAGE = 0.5; // 0.5%

/** Replace with the V4 position tokenId you actually own */
const TOKEN_ID = "59";
/** Amount of liquidity to remove */
const LIQUIDITY = "205051642";

async function main() {
  await initWallet();
  if (!isWalletConfigured()) {
    console.error("Error: No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC in .env");
    process.exit(1);
  }
  const wallet = getWallet();
  const kit = new SunKit({ wallet, network: NETWORK });

  const PM = SunKit.getCLPositionManagerAddress(NETWORK);

  console.log("=== V4 Decrease Liquidity Test ===");
  console.log("TRON_PRIVATE_KEY set:", !!process.env.TRON_PRIVATE_KEY);
  console.log("network:", NETWORK);
  console.log("CLPositionManager:", PM);
  console.log("tokenId:", TOKEN_ID);
  console.log("liquidity:", LIQUIDITY);
  console.log("token0:", TOKEN_0, "token1:", TOKEN_1, "fee:", FEE);
  console.log("");

  console.log("--- Step 1: Read position info ---");
  try {
    const posInfo = await kit.getV4PositionInfo(NETWORK, PM, TOKEN_ID);
    if (posInfo) {
      console.log("Position info:");
      console.log(JSON.stringify(posInfo, null, 2));
      console.log("");
      console.log("Current liquidity:", posInfo.liquidity);
      console.log("tickLower:", posInfo.tickLower, "tickUpper:", posInfo.tickUpper);
    } else {
      console.log("Position not found or not readable");
    }
  } catch (err) {
    console.log("Could not read position info:", (err as Error).message);
  }
  console.log("");

  console.log("--- Step 2: Decrease liquidity ---");
  try {
    const result = await kit.decreaseLiquidityV4({
      network: NETWORK,
      tokenId: TOKEN_ID,
      liquidity: LIQUIDITY,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      slippage: SLIPPAGE,
    });

    console.log("Decrease result:");
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
