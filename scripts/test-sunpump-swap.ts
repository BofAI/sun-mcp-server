/**
 * Test script for SunPump trading via executeSwap
 *
 * This tests the integrated swap flow that automatically routes
 * TRX <-> MemeToken trades through SunPump when the token is in TRADING state.
 *
 * Usage: npm run script:test-sunpump-swap
 */

import dotenv from "dotenv";
dotenv.config();

import { executeSwap } from "../src/sunswap/swap";
import { getSunPumpTokenInfo, SunPumpTokenState } from "../src/sunswap/sunpump";
import { isLocalWalletConfigured, getWalletAddress, initWallet } from "../src/wallet";
import { TRX_ADDRESS } from "../src/sunswap/constants";

// ===================== Configuration =====================
const NETWORK = "nile";
// Replace with actual SunPump meme token address
const MEME_TOKEN = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
// Amount of TRX to spend on buy (in sun, 1 TRX = 1,000,000 sun)
const BUY_TRX_AMOUNT = "1000000"; // 1 TRX
// Amount of tokens to sell (in smallest units, e.g. 18 decimals)
const SELL_TOKEN_AMOUNT = "1000000"; // 1000 tokens (if 18 decimals)
// Slippage tolerance
const SLIPPAGE = 0.05; // 5%
// Test mode: "buy" | "sell" | "both"
const TEST_MODE: "buy" | "sell" | "both" = "sell";
// =========================================================

async function main() {
  console.log("=== SunPump Swap Integration Test ===\n");

  // Check wallet configuration
  if (!isLocalWalletConfigured()) {
    console.error("Error: No wallet configured.");
    console.error("Run: npm run wallet:setup");
    process.exit(1);
  }

  // Initialize wallet singleton
  await initWallet();

  const walletAddress = await getWalletAddress();
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Meme Token: ${MEME_TOKEN}`);
  console.log(`Test Mode: ${TEST_MODE}\n`);

  // 1. Check token status
  console.log("--- Step 1: Checking Token Status ---");
  try {
    const tokenInfo = await getSunPumpTokenInfo(MEME_TOKEN, NETWORK);
    console.log("Token Info:");
    console.log(`  State: ${tokenInfo.state} (0=not exist, 1=trading, 2=launched)`);
    console.log(`  Price: ${tokenInfo.price}`);
    console.log(`  TRX Reserve: ${Number(tokenInfo.trxReserve) / 1e6} TRX`);
    console.log(`  Token Reserve: ${tokenInfo.tokenReserve}`);
    console.log(`  Launched: ${tokenInfo.launched}`);

    if (tokenInfo.state === SunPumpTokenState.NOT_EXIST) {
      console.log("\nToken does not exist on SunPump. Swap will use Universal Router.");
    } else if (tokenInfo.state === SunPumpTokenState.LAUNCHED) {
      console.log("\nToken has launched to DEX. Swap will use Universal Router.");
    } else {
      console.log("\nToken is in TRADING state. Swap will use SunPump bonding curve.");
    }
    console.log();
  } catch (error) {
    console.error("Failed to get token info:", error);
    process.exit(1);
  }

  // 2. Test Buy (TRX -> MemeToken)
  if (TEST_MODE === "buy" || TEST_MODE === "both") {
    console.log("--- Step 2: Testing Buy (TRX -> MemeToken) ---");
    console.log(`Buying with ${Number(BUY_TRX_AMOUNT) / 1e6} TRX...`);
    console.log("WARNING: This will spend real TRX. Press Ctrl+C to cancel.");
    console.log("Waiting 5 seconds...\n");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const buyResult = await executeSwap({
        tokenIn: TRX_ADDRESS,
        tokenOut: MEME_TOKEN,
        amountIn: BUY_TRX_AMOUNT,
        network: NETWORK,
        slippage: SLIPPAGE,
      });

      console.log("Buy Result:");
      console.log(`  TX ID: ${buyResult.txid}`);
      console.log(`  Source: ${buyResult.source}`);
      console.log(`  Amount In: ${buyResult.route.amountIn}`);
      console.log(`  Amount Out: ${buyResult.route.amountOut}`);
      console.log(`  Pool Versions: ${buyResult.route.poolVersions.join(", ")}`);
      console.log();
    } catch (error) {
      console.error("Buy failed:", error);
      if (TEST_MODE === "buy") {
        process.exit(1);
      }
    }
  }

  // 3. Test Sell (MemeToken -> TRX)
  if (TEST_MODE === "sell" || TEST_MODE === "both") {
    console.log("--- Step 3: Testing Sell (MemeToken -> TRX) ---");

    // If we just bought, wait a bit
    if (TEST_MODE === "both") {
      console.log("Waiting 5 seconds for buy tx to confirm...\n");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Get current token balance
    const { getMemeTokenBalance } = await import("../src/sunswap/sunpump");
    const balance = await getMemeTokenBalance(MEME_TOKEN, walletAddress, NETWORK);
    console.log(`Current Token Balance: ${balance}`);
    console.log(`Sell Amount: ${SELL_TOKEN_AMOUNT}`);

    if (BigInt(balance) < BigInt(SELL_TOKEN_AMOUNT)) {
      console.error(`Insufficient balance. Have ${balance}, need ${SELL_TOKEN_AMOUNT}`);
      process.exit(1);
    }

    console.log("WARNING: This will sell your tokens. Press Ctrl+C to cancel.");
    console.log("Waiting 5 seconds...\n");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const sellResult = await executeSwap({
        tokenIn: MEME_TOKEN,
        tokenOut: TRX_ADDRESS,
        amountIn: SELL_TOKEN_AMOUNT,
        network: NETWORK,
        slippage: SLIPPAGE,
      });

      console.log("Sell Result:");
      console.log(`  TX ID: ${sellResult.txid}`);
      console.log(`  Source: ${sellResult.source}`);
      console.log(`  Amount In: ${sellResult.route.amountIn}`);
      console.log(`  Amount Out: ${sellResult.route.amountOut}`);
      console.log(`  Pool Versions: ${sellResult.route.poolVersions.join(", ")}`);
      console.log();
    } catch (error) {
      console.error("Sell failed:", error);
      process.exit(1);
    }
  }

  console.log("=== Test Complete ===");
}

main().catch(console.error);
