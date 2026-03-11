/**
 * Test script for SunPump meme token sell (bonding curve)
 *
 * Usage: npm run script:test-sunpump-sell
 *
 * Make sure to:
 * 1. Configure wallet: npm run wallet:setup
 * 2. Have meme token balance in wallet
 * 3. Update TOKEN_ADDRESS to a valid SunPump token you own
 */

import dotenv from "dotenv";
dotenv.config();

import {
  getSunPumpTokenInfo,
  quoteSell,
  sellToken,
  getMemeTokenBalance,
} from "../src/sunswap/sunpump";
import { isLocalWalletConfigured, getWalletAddress } from "../src/sunswap/wallet";

// ===================== Configuration =====================
const NETWORK = "nile";
// Replace with actual SunPump meme token address you own
const TOKEN_ADDRESS = "TAsJEbT9URv9TCZukeuuhG21tywNzvn6P5";
// Percentage of balance to sell (1-100)
// Note: Selling too few tokens may result in TRX amount < fee, causing REVERT
const SELL_PERCENTAGE = 10; // Sell 10% of balance
const SLIPPAGE = 0.05; // 5%
// =========================================================

async function main() {
  console.log("=== SunPump Sell Test ===\n");

  // Check wallet configuration
  if (!isLocalWalletConfigured()) {
    console.error("Error: No wallet configured.");
    console.error("Run: npm run wallet:setup");
    process.exit(1);
  }

  const walletAddress = await getWalletAddress({ network: NETWORK });
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Token: ${TOKEN_ADDRESS}`);
  console.log(`Sell Percentage: ${SELL_PERCENTAGE}%\n`);

  // 1. Get token info
  console.log("--- Step 1: Getting Token Info ---");
  try {
    const tokenInfo = await getSunPumpTokenInfo(TOKEN_ADDRESS, NETWORK);
    console.log("Token Info:");
    console.log(`  State: ${tokenInfo.state} (0=not exist, 1=trading, 2=launched)`);
    console.log(`  Price: ${tokenInfo.price}`);
    console.log(`  TRX Reserve: ${Number(tokenInfo.trxReserve) / 1e6} TRX`);
    console.log(`  Token Reserve: ${tokenInfo.tokenReserve}`);
    console.log(`  Launched to DEX: ${tokenInfo.launched}\n`);

    if (tokenInfo.state === 0) {
      console.error("Token does not exist on SunPump.");
      process.exit(1);
    }
    if (tokenInfo.launched) {
      console.error("Token has already launched to DEX. Use SunSwap V2 for trading.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed to get token info:", error);
    process.exit(1);
  }

  // 2. Check current balance and calculate sell amount
  console.log("--- Step 2: Current Token Balance ---");
  let currentBalance: string;
  let tokenAmount: string;
  try {
    currentBalance = await getMemeTokenBalance(TOKEN_ADDRESS, walletAddress, NETWORK);
    console.log(`Current Balance: ${currentBalance}`);

    if (BigInt(currentBalance) === 0n) {
      console.error("No token balance to sell.");
      process.exit(1);
    }

    // Calculate amount to sell based on percentage
    tokenAmount = ((BigInt(currentBalance) * BigInt(SELL_PERCENTAGE)) / 100n).toString();
    console.log(`Amount to Sell (${SELL_PERCENTAGE}%): ${tokenAmount}\n`);
  } catch (error) {
    console.error("Failed to get balance:", error);
    process.exit(1);
  }

  // 3. Get quote
  console.log("--- Step 3: Getting Quote ---");
  try {
    const quote = await quoteSell(TOKEN_ADDRESS, tokenAmount, NETWORK);
    console.log("Quote:");
    console.log(`  Expected TRX: ${Number(quote.trxAmount) / 1e6} TRX`);
    console.log(`  Fee: ${Number(quote.fee) / 1e6} TRX\n`);
  } catch (error) {
    console.error("Failed to get quote:", error);
    console.error("Note: If amount is too small, TRX return may be less than fee.");
    process.exit(1);
  }

  // 4. Execute sell
  console.log("--- Step 4: Executing Sell ---");
  console.log("WARNING: This will sell your tokens. Press Ctrl+C to cancel.");
  console.log("Waiting 5 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    const result = await sellToken({
      tokenAddress: TOKEN_ADDRESS,
      tokenAmount: tokenAmount,
      slippage: SLIPPAGE,
      network: NETWORK,
    });

    console.log("Sell Result:");
    console.log(`  TX Result: ${JSON.stringify(result.txResult, null, 2)}`);
    console.log(`  Tokens Sold: ${result.tokensSold}`);
    console.log(`  Expected TRX: ${Number(result.expectedTrx) / 1e6} TRX`);
    console.log(`  Min TRX Out: ${Number(result.minTrxOut) / 1e6} TRX\n`);
  } catch (error) {
    console.error("Sell failed:", error);
    process.exit(1);
  }

  // 5. Check new balance
  console.log("--- Step 5: New Token Balance ---");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  try {
    const newBalance = await getMemeTokenBalance(TOKEN_ADDRESS, walletAddress, NETWORK);
    console.log(`New Balance: ${newBalance}`);
    console.log(`Tokens Sold: ${BigInt(currentBalance) - BigInt(newBalance)}\n`);
  } catch (error) {
    console.error("Failed to get new balance:", error);
  }

  console.log("=== Sell Test Complete ===");
}

main().catch(console.error);
