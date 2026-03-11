/**
 * SunPump (Meme Token Launchpad) trading module
 * Implements bonding curve buy/sell for internal (pre-DEX) trading
 */

import { readContract, sendContractTx, getReadonlyTronWeb } from "./contracts";
import { getWalletAddress, type AgentWalletProvider } from "./wallet";
import { SUNPUMP_MAINNET, SUNPUMP_NILE, SUNPUMP_ABI, TRC20_MIN_ABI } from "./constants";

// ---------------------------------------------------------------------------
// Contract Address Resolution
// ---------------------------------------------------------------------------

/** Get SunPump contract address for the network. */
export function getSunPumpAddress(network: string): string {
  const n = network.toLowerCase();
  if (n === "mainnet" || n === "tron" || n === "trx") return SUNPUMP_MAINNET;
  if (n === "nile" || n === "testnet") return SUNPUMP_NILE;
  throw new Error(`Unsupported network for SunPump: ${network}`);
}

// ---------------------------------------------------------------------------
// Token Info & Price Queries
// ---------------------------------------------------------------------------

// Token states from getTokenState
export enum SunPumpTokenState {
  NOT_EXIST = 0,
  TRADING = 1,
  LAUNCHED = 2,
}

export interface SunPumpTokenInfo {
  tokenAddress: string;
  state: SunPumpTokenState;
  price: string;
  launched: boolean;
  trxReserve: string;
  tokenReserve: string;
}

/**
 * Get token state from SunPump.
 * Returns: 0 = not exist, 1 = trading on bonding curve, 2 = launched to DEX
 */
export async function getTokenState(
  tokenAddress: string,
  network: string = "mainnet",
): Promise<SunPumpTokenState> {
  const sunpumpAddress = getSunPumpAddress(network);

  try {
    const result = await readContract(
      {
        address: sunpumpAddress,
        functionName: "getTokenState",
        args: [tokenAddress],
        abi: SUNPUMP_ABI,
      },
      network,
    );

    return Number(result) as SunPumpTokenState;
  } catch (error) {
    throw new Error(
      `Failed to get token state for ${tokenAddress}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Get token price from SunPump bonding curve.
 */
export async function getTokenPrice(
  tokenAddress: string,
  network: string = "mainnet",
): Promise<string> {
  const sunpumpAddress = getSunPumpAddress(network);

  try {
    const result = await readContract(
      {
        address: sunpumpAddress,
        functionName: "getPrice",
        args: [tokenAddress],
        abi: SUNPUMP_ABI,
      },
      network,
    );

    return BigInt(result as string | number | bigint).toString();
  } catch (error) {
    throw new Error(
      `Failed to get token price for ${tokenAddress}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Get virtual pool info for a token.
 */
export async function getVirtualPool(
  tokenAddress: string,
  network: string = "mainnet",
): Promise<{ trxReserve: string; tokenReserve: string; launched: boolean }> {
  const sunpumpAddress = getSunPumpAddress(network);

  try {
    const result = await readContract(
      {
        address: sunpumpAddress,
        functionName: "virtualPools",
        args: [tokenAddress],
        abi: SUNPUMP_ABI,
      },
      network,
    );

    const arr = Array.isArray(result) ? result : [result];
    return {
      trxReserve: BigInt(arr[0] || 0).toString(),
      tokenReserve: BigInt(arr[1] || 0).toString(),
      launched: Boolean(arr[2]),
    };
  } catch (error) {
    throw new Error(
      `Failed to get virtual pool for ${tokenAddress}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Get token info from SunPump bonding curve.
 * Returns state, price, and reserve info.
 */
export async function getSunPumpTokenInfo(
  tokenAddress: string,
  network: string = "mainnet",
): Promise<SunPumpTokenInfo> {
  const state = await getTokenState(tokenAddress, network);
  
  let price = "0";
  let trxReserve = "0";
  let tokenReserve = "0";
  let launched = state === SunPumpTokenState.LAUNCHED;

  if (state === SunPumpTokenState.TRADING || state === SunPumpTokenState.LAUNCHED) {
    try {
      const pool = await getVirtualPool(tokenAddress, network);
      trxReserve = pool.trxReserve;
      tokenReserve = pool.tokenReserve;
      launched = pool.launched;
    } catch {
      // Pool query may fail
    }

    if (state === SunPumpTokenState.TRADING) {
      try {
        price = await getTokenPrice(tokenAddress, network);
      } catch {
        // Price query may fail for some tokens
      }
    }
  }

  return {
    tokenAddress,
    state,
    price,
    launched,
    trxReserve,
    tokenReserve,
  };
}

/**
 * Check if a token has been launched to DEX (graduated from bonding curve).
 */
export async function isTokenLaunched(
  tokenAddress: string,
  network: string = "mainnet",
): Promise<boolean> {
  const state = await getTokenState(tokenAddress, network);
  return state === SunPumpTokenState.LAUNCHED;
}

// ---------------------------------------------------------------------------
// Quote Functions
// ---------------------------------------------------------------------------

/**
 * Calculate how many tokens you'll receive for a given TRX amount.
 * Uses getTokenAmountByPurchaseWithFee to get the exact amount after fee.
 */
export async function quoteBuy(
  tokenAddress: string,
  trxAmount: string,
  network: string = "mainnet",
): Promise<{ tokenAmount: string; fee: string }> {
  const sunpumpAddress = getSunPumpAddress(network);
  const trxIn = BigInt(trxAmount);

  try {
    const result = await readContract(
      {
        address: sunpumpAddress,
        functionName: "getTokenAmountByPurchaseWithFee",
        args: [tokenAddress, trxIn.toString()],
        abi: SUNPUMP_ABI,
      },
      network,
    );

    const arr = Array.isArray(result) ? result : [result, 0];
    const tokenAmount = BigInt(arr[0] || 0);
    const fee = BigInt(arr[1] || 0);

    return {
      tokenAmount: tokenAmount.toString(),
      fee: fee.toString(),
    };
  } catch (error) {
    throw new Error(
      `Failed to quote buy for ${tokenAddress}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Calculate how much TRX you'll receive for selling tokens.
 * Uses getTrxAmountBySaleWithFee to get the exact amount after fee.
 */
export async function quoteSell(
  tokenAddress: string,
  tokenAmount: string,
  network: string = "mainnet",
): Promise<{ trxAmount: string; fee: string }> {
  const sunpumpAddress = getSunPumpAddress(network);
  const tokensIn = BigInt(tokenAmount);

  try {
    const result = await readContract(
      {
        address: sunpumpAddress,
        functionName: "getTrxAmountBySaleWithFee",
        args: [tokenAddress, tokensIn.toString()],
        abi: SUNPUMP_ABI,
      },
      network,
    );

    const arr = Array.isArray(result) ? result : [result, 0];
    const trxAmount = BigInt(arr[0] || 0);
    const fee = BigInt(arr[1] || 0);

    return {
      trxAmount: trxAmount.toString(),
      fee: fee.toString(),
    };
  } catch (error) {
    throw new Error(
      `Failed to quote sell for ${tokenAddress}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

// ---------------------------------------------------------------------------
// Buy / Sell Functions
// ---------------------------------------------------------------------------

export interface BuyTokenParams {
  tokenAddress: string;
  trxAmount: string;
  minTokenOut?: string;
  slippage?: number;
  network?: string;
  provider?: AgentWalletProvider;
}

export interface BuyTokenResult {
  txResult: unknown;
  tokenAddress: string;
  trxSpent: string;
  expectedTokens: string;
  minTokenOut: string;
}

/**
 * Buy meme token from SunPump bonding curve using TRX.
 */
export async function buyToken(params: BuyTokenParams): Promise<BuyTokenResult> {
  const network = params.network || "mainnet";
  const slippage = params.slippage ?? 0.05;
  const sunpumpAddress = getSunPumpAddress(network);

  const state = await getTokenState(params.tokenAddress, network);
  if (state === SunPumpTokenState.NOT_EXIST) {
    throw new Error(`Token ${params.tokenAddress} does not exist on SunPump.`);
  }
  if (state === SunPumpTokenState.LAUNCHED) {
    throw new Error(
      `Token ${params.tokenAddress} has already launched to DEX. Use SunSwap V2 for trading.`,
    );
  }

  const quote = await quoteBuy(params.tokenAddress, params.trxAmount, network);
  const expectedTokens = BigInt(quote.tokenAmount);

  let minTokenOut: bigint;
  if (params.minTokenOut) {
    minTokenOut = BigInt(params.minTokenOut);
  } else {
    const slippageMultiplier = BigInt(Math.floor((1 - slippage) * 10000));
    minTokenOut = (expectedTokens * slippageMultiplier) / 10000n;
  }

  const txResult = await sendContractTx({
    address: sunpumpAddress,
    functionName: "purchaseToken",
    args: [params.tokenAddress, minTokenOut.toString()],
    value: params.trxAmount,
    abi: SUNPUMP_ABI,
    network,
    provider: params.provider,
  });

  return {
    txResult,
    tokenAddress: params.tokenAddress,
    trxSpent: params.trxAmount,
    expectedTokens: expectedTokens.toString(),
    minTokenOut: minTokenOut.toString(),
  };
}

export interface SellTokenParams {
  tokenAddress: string;
  tokenAmount: string;
  minTrxOut?: string;
  slippage?: number;
  network?: string;
  provider?: AgentWalletProvider;
}

export interface SellTokenResult {
  txResult: unknown;
  tokenAddress: string;
  tokensSold: string;
  expectedTrx: string;
  minTrxOut: string;
}

/**
 * Sell meme token back to SunPump bonding curve for TRX.
 */
export async function sellToken(params: SellTokenParams): Promise<SellTokenResult> {
  const network = params.network || "mainnet";
  const slippage = params.slippage ?? 0.05;
  const sunpumpAddress = getSunPumpAddress(network);

  const state = await getTokenState(params.tokenAddress, network);
  if (state === SunPumpTokenState.NOT_EXIST) {
    throw new Error(`Token ${params.tokenAddress} does not exist on SunPump.`);
  }
  if (state === SunPumpTokenState.LAUNCHED) {
    throw new Error(
      `Token ${params.tokenAddress} has already launched to DEX. Use SunSwap V2 for trading.`,
    );
  }

  const quote = await quoteSell(params.tokenAddress, params.tokenAmount, network);
  const expectedTrx = BigInt(quote.trxAmount);

  let minTrxOut: bigint;
  if (params.minTrxOut) {
    minTrxOut = BigInt(params.minTrxOut);
  } else {
    const slippageMultiplier = BigInt(Math.floor((1 - slippage) * 10000));
    minTrxOut = (expectedTrx * slippageMultiplier) / 10000n;
  }

  const tronWeb = await getReadonlyTronWeb(network);
  const ownerAddress = await getWalletAddress({ network, provider: params.provider });

  const tokenContract = await tronWeb.contract(TRC20_MIN_ABI as never, params.tokenAddress);
  const allowance = await (
    (tokenContract as unknown) as {
      allowance: (owner: string, spender: string) => { call: () => Promise<unknown> };
    }
  )
    .allowance(ownerAddress, sunpumpAddress)
    .call();
  const currentAllowance = BigInt(allowance as string | number);
  const tokenAmountBigInt = BigInt(params.tokenAmount);

  if (currentAllowance < tokenAmountBigInt) {
    const maxUint256 = 2n ** 256n - 1n;
    await sendContractTx({
      address: params.tokenAddress,
      functionName: "approve",
      args: [sunpumpAddress, maxUint256.toString()],
      abi: TRC20_MIN_ABI,
      network,
      provider: params.provider,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const txResult = await sendContractTx({
    address: sunpumpAddress,
    functionName: "saleToken",
    args: [params.tokenAddress, params.tokenAmount, minTrxOut.toString()],
    abi: SUNPUMP_ABI,
    network,
    provider: params.provider,
  });

  return {
    txResult,
    tokenAddress: params.tokenAddress,
    tokensSold: params.tokenAmount,
    expectedTrx: expectedTrx.toString(),
    minTrxOut: minTrxOut.toString(),
  };
}

// ---------------------------------------------------------------------------
// Utility: Get Token Balance
// ---------------------------------------------------------------------------

/**
 * Get user's balance of a SunPump meme token.
 */
export async function getMemeTokenBalance(
  tokenAddress: string,
  ownerAddress?: string,
  network: string = "mainnet",
  provider?: AgentWalletProvider,
): Promise<string> {
  const tronWeb = await getReadonlyTronWeb(network);
  const owner = ownerAddress || (await getWalletAddress({ network, provider }));

  const tokenContract = await tronWeb.contract(TRC20_MIN_ABI as never, tokenAddress);
  const balance = await (
    (tokenContract as unknown) as {
      balanceOf: (account: string) => { call: () => Promise<unknown> };
    }
  )
    .balanceOf(owner)
    .call();

  return BigInt(balance as string | number).toString();
}
