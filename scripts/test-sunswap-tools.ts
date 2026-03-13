#!/usr/bin/env npx ts-node
/**
 * Aggregate test for SUNSWAP custom tools backed by SunKit / SunAPI.
 *
 * Covered tools (matching the tools listed in the README):
 * - sunswap_get_wallet_address / sunswap_get_balances
 * - sunswap_get_token_price
 * - sunswap_read_contract
 * - sunswap_send_contract   (disabled by default; must be explicitly enabled)
 * - sunswap_quote_exact_input (disabled by default; you must provide router / args)
 * - sunswap_swap_exact_input  (disabled by default; you must provide router / args)
 * - sunswap_swap              (disabled by default to avoid accidental trades; see SunPump scripts)
 *
 * In addition, there are dedicated scripts for V2/V3/V4 liquidity, SunPump, and OpenAPI:
 * - V2: test-add-liquidity.ts / test-remove-liquidity.ts
 * - V3: test-v3-mint.ts / test-v3-increase.ts / test-v3-decrease.ts / test-v3-collect.ts
 * - V4: test-v4-mint.ts / test-v4-increase.ts / test-v4-decrease.ts / test-v4-collect.ts
 * - SunPump: test-sunpump-buy.ts / test-sunpump-sell.ts / test-sunpump-swap.ts
 * - OpenAPI: test-openapi.ts
 *
 * Example run:
 *   npm run script:test-sunswap-tools
 *
 * Optional flags (controlled via environment variables; default is read-only or skipped):
 *   ENABLE_SEND_CONTRACT=1        enable send_contract example (performs a real transaction!)
 *   ENABLE_ROUTER_QUOTE=1        enable quote_exact_input example
 *   ENABLE_SWAP_EXACT_INPUT=1    enable swap_exact_input example
 *   ENABLE_SWAP=1                enable swap example (for most cases, prefer SunPump test scripts)
 *
 * Before running, make sure:
 *   1. Wallet is configured: npm run wallet:setup
 *   2. .env contains TRON_PRIVATE_KEY or another supported wallet configuration
 */

import "dotenv/config";
import { SunKit, SunAPI, SUNSWAP_V2_NILE_ROUTER } from "@bankofai/sun-kit";
import { initWallet, getWallet, isWalletConfigured, getWalletAddress } from "../src/wallet";

const NETWORK = process.env.TRON_NETWORK || "nile";

// Common addresses (adjust as needed)
const TRX_ADDRESS = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
const USDT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

async function main() {
  console.log("=== SUNSWAP Tools Aggregate Test ===\n");

  // Initialize wallet (even read-only flows reuse the same SunKit instance)
  await initWallet();
  if (!isWalletConfigured()) {
    console.error("Error: No wallet configured. Set TRON_PRIVATE_KEY or TRON_MNEMONIC in .env");
    console.error("Run: npm run wallet:setup");
    process.exit(1);
  }

  const wallet = getWallet();
  const kit = new SunKit({ wallet, network: NETWORK });
  const api = new SunAPI();
  const walletAddress = await getWalletAddress();

  console.log("Network:", NETWORK);
  console.log("Wallet:", walletAddress);
  console.log("");

  // ---------------------------------------------------------------------------
  // 1) sunswap_get_wallet_address / sunswap_get_balances
  // ---------------------------------------------------------------------------
  console.log("=== 1) Wallet & Balances (get_wallet_address / get_balances) ===");
  console.log("Active wallet address:", walletAddress);

  try {
    const balances = await kit.getBalances({
      network: NETWORK,
      ownerAddress: walletAddress,
      tokens: [
        { address: walletAddress, type: "TRX" as const },
        { address: walletAddress, type: "TRC20" as const, tokenAddress: USDT_ADDRESS },
      ],
    });
    console.log("Balances result:");
    console.log(JSON.stringify(balances, null, 2));
  } catch (err) {
    console.error("getBalances error:", (err as Error).message);
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // 2) sunswap_get_token_price  (SunAPI.getPrice)
  // ---------------------------------------------------------------------------
  console.log("=== 2) Token Price via SUN.IO API (get_token_price) ===");
  try {
    const priceResult = await api.getPrice({ symbol: "SUN,TRX,USDT" });
    console.log("getPrice result:");
    console.log(JSON.stringify(priceResult, null, 2));
  } catch (err) {
    console.error("getPrice error:", (err as Error).message);
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // 3) sunswap_read_contract  (readContract)
  //    Example: read USDT.balanceOf(wallet)
  // ---------------------------------------------------------------------------
  console.log("=== 3) Read Contract (read_contract) ===");
  try {
    const readResult = await kit.readContract(
      {
        address: USDT_ADDRESS,
        functionName: "balanceOf",
        args: [walletAddress],
      },
      NETWORK,
    );
    console.log("USDT.balanceOf(wallet) result:");
    console.log(JSON.stringify(readResult, null, 2));
  } catch (err) {
    console.error("readContract error:", (err as Error).message);
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // 4) sunswap_send_contract  (sendContractTx)
  //    Disabled by default to avoid accidental on-chain transfers.
  // ---------------------------------------------------------------------------
  if (process.env.ENABLE_SEND_CONTRACT === "1") {
    console.log("=== 4) Send Contract (send_contract) ===");
    console.log("WARNING: This will send a real transaction. Make sure you understand the call.");

    // Example: USDT.transfer(to, amount) — fill in a real address and amount before enabling
    const RECIPIENT = process.env.TEST_USDT_RECIPIENT || walletAddress;
    const AMOUNT = process.env.TEST_USDT_AMOUNT || "1"; // raw amount; adjust according to token decimals

    console.log("Contract:", USDT_ADDRESS);
    console.log("Function: transfer");
    console.log("To:", RECIPIENT);
    console.log("Amount (raw):", AMOUNT);

    try {
      const sendResult = await kit.sendContractTx({
        address: USDT_ADDRESS,
        functionName: "transfer",
        args: [RECIPIENT, AMOUNT],
        network: NETWORK,
      });
      console.log("sendContractTx result:");
      console.log(JSON.stringify(sendResult, null, 2));
    } catch (err) {
      console.error("sendContractTx error:", (err as Error).message);
    }
    console.log("");
  } else {
    console.log("=== 4) Send Contract (send_contract) ===");
    console.log("Skipped. Set ENABLE_SEND_CONTRACT=1 to enable this section.\n");
  }

  // ---------------------------------------------------------------------------
  // 5) sunswap_quote_exact_input  (quoteExactInput)
  //    Because router/ABI differ by environment, this is a configurable template only:
  //    - Use ENV to set router + functionName + args (JSON)
  // ---------------------------------------------------------------------------
  if (process.env.ENABLE_ROUTER_QUOTE === "1") {
    console.log("=== 5) Quote Exact Input (quote_exact_input) ===");
    const routerAddress =
      process.env.SUN_ROUTER_ADDRESS || SUNSWAP_V2_NILE_ROUTER; // placeholder; typically use the Smart Router
    const functionName = process.env.ROUTER_QUOTE_FN || "quoteExactInput";
    const rawArgs = process.env.ROUTER_QUOTE_ARGS || "[]";

    let args: any[];
    try {
      args = JSON.parse(rawArgs);
    } catch {
      console.error(
        'ROUTER_QUOTE_ARGS is not a valid JSON array, example: "[\\"0x01\\", \\"1000000\\"]"',
      );
      process.exit(1);
    }

    console.log("routerAddress:", routerAddress);
    console.log("functionName:", functionName);
    console.log("args:", args);

    try {
      const result = await kit.quoteExactInput({
        network: NETWORK,
        routerAddress,
        functionName,
        args,
      });
      console.log("quoteExactInput result:");
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("quoteExactInput error:", (err as Error).message);
    }
    console.log("");
  } else {
    console.log("=== 5) Quote Exact Input (quote_exact_input) ===");
    console.log(
      "Skipped. Set ENABLE_ROUTER_QUOTE=1 and configure SUN_ROUTER_ADDRESS / ROUTER_QUOTE_FN / ROUTER_QUOTE_ARGS to enable.",
    );
    console.log("");
  }

  // ---------------------------------------------------------------------------
  // 6) sunswap_swap_exact_input  (swapExactInput)
  //    Also controlled via ENV for router + functionName + args + value.
  // ---------------------------------------------------------------------------
  if (process.env.ENABLE_SWAP_EXACT_INPUT === "1") {
    console.log("=== 6) Router Swap Exact Input (swap_exact_input) ===");
    const routerAddress =
      process.env.SUN_ROUTER_ADDRESS || SUNSWAP_V2_NILE_ROUTER; // placeholder; ideally use the Universal Router
    const functionName = process.env.ROUTER_SWAP_FN || "swapExactInput";
    const rawArgs = process.env.ROUTER_SWAP_ARGS || "[]";
    const value = process.env.ROUTER_SWAP_VALUE; // optional attached TRX amount (Sun)

    let args: any[];
    try {
      args = JSON.parse(rawArgs);
    } catch {
      console.error("ROUTER_SWAP_ARGS is not a valid JSON array");
      process.exit(1);
    }

    console.log("routerAddress:", routerAddress);
    console.log("functionName:", functionName);
    console.log("args:", args);
    console.log("value (Sun):", value ?? "(none)");
    console.log("WARNING: This may execute a real swap via router. Check params carefully.");

    try {
      const txResult = await kit.swapExactInput({
        network: NETWORK,
        routerAddress,
        functionName,
        args,
        value,
      });
      console.log("swapExactInput txResult:");
      console.log(JSON.stringify(txResult, null, 2));
    } catch (err) {
      console.error("swapExactInput error:", (err as Error).message);
    }
    console.log("");
  } else {
    console.log("=== 6) Router Swap Exact Input (swap_exact_input) ===");
    console.log("Skipped. Set ENABLE_SWAP_EXACT_INPUT=1 to enable this section.\n");
  }

  // ---------------------------------------------------------------------------
  // 7) sunswap_swap  (high-level swap that chooses between SunPump / router)
  //    This uses a TRX -> USDT example template and is disabled by default.
  // ---------------------------------------------------------------------------
  if (process.env.ENABLE_SWAP === "1") {
    console.log("=== 7) High-level Swap (swap) ===");
    const amountIn = process.env.SWAP_TRX_AMOUNT || "1000000"; // 1 TRX
    const slippage = Number(process.env.SWAP_SLIPPAGE || "0.01"); // default 1%

    console.log(`Swapping ${Number(amountIn) / 1e6} TRX -> USDT with slippage ${slippage * 100}%`);
    console.log("WARNING: This will perform a real swap. Press Ctrl+C to cancel.\n");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const result = await kit.swap({
        tokenIn: TRX_ADDRESS,
        tokenOut: USDT_ADDRESS,
        amountIn,
        network: NETWORK,
        slippage,
      });
      console.log("swap result:");
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("swap error:", (err as Error).message);
    }
    console.log("");
  } else {
    console.log("=== 7) High-level Swap (swap) ===");
    console.log("Skipped. Set ENABLE_SWAP=1 to enable this section.\n");
  }

  console.log("=== SUNSWAP tools aggregate test finished ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

