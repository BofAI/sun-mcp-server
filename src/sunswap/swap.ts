import type { TronWeb } from "tronweb";
import {
  TradePlanner,
  parseRouteAPIResponse,
  type ParseRouteOptions,
} from "@sun-protocol/universal-router-sdk";
import { AllowanceTransfer, type PermitSingleWithSignature, PERMIT_TYPES } from "@sun-protocol/permit2-sdk";
import { getWallet } from "../wallet";
import { signAndBroadcastContractTx, buildRawContractTx, ensureTokenAllowance } from "./contracts";
import { MAINNET, NILE, TRX_ADDRESS, type SwapConstants } from "./constants";
import {
  getTokenState,
  SunPumpTokenState,
  buyToken as sunpumpBuy,
  sellToken as sunpumpSell,
} from "./sunpump";

const SWAP_SUPPORTED_NETWORKS: Record<string, SwapConstants> = {
  mainnet: MAINNET,
  nile: NILE,
};

function getSwapConstants(network: string): SwapConstants {
  const constants = SWAP_SUPPORTED_NETWORKS[network];
  if (!constants) {
    throw new Error(`Swap is not supported on network "${network}". Supported: ${Object.keys(SWAP_SUPPORTED_NETWORKS).join(", ")}`);
  }
  return constants;
}

// ---------------------------------------------------------------------------
// Router API
// ---------------------------------------------------------------------------

interface RouterAPIParams {
  fromToken: string;
  toToken: string;
  amountIn: string;
  typeList?: string;
  maxCost?: number;
}

interface RouterAPIResponse {
  code: number;
  message: string;
  data: any[];
}

async function fetchRouterAPI(params: RouterAPIParams, baseUrl: string): Promise<RouterAPIResponse> {
  const { fromToken, toToken, amountIn, typeList = "", maxCost = 3 } = params;

  const url = new URL("/swap/routerUniversal", baseUrl);
  url.searchParams.append("fromToken", fromToken);
  url.searchParams.append("toToken", toToken);
  url.searchParams.append("amountIn", amountIn);
  url.searchParams.append("typeList", typeList);
  url.searchParams.append("maxCost", maxCost.toString());
  url.searchParams.append("includeUnverifiedV4Hook", "true");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Router API HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as RouterAPIResponse;
  if (data.code !== 0) {
    throw new Error(`Router API error: ${data.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Main swap function
// ---------------------------------------------------------------------------

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  network?: string;
  slippage?: number;
}

export interface SwapResult {
  txid: string;
  route: {
    amountIn: string;
    amountOut: string;
    symbols: string[];
    poolVersions: string[];
    impact: string;
  };
  source?: "sunpump" | "universal_router";
}

/**
 * Execute swap via SunPump bonding curve (for meme tokens in TRADING state).
 */
async function executeSunPumpSwap(
  params: SwapParams,
  isBuy: boolean,
  memeToken: string,
  slippage: number,
): Promise<SwapResult> {
  const network = params.network || "mainnet";

  if (isBuy) {
    // TRX -> MemeToken (buy)
    const result = await sunpumpBuy({
      tokenAddress: memeToken,
      trxAmount: params.amountIn,
      slippage,
      network,
    });

    const txResult = result.txResult as { txid?: string; transaction?: { txID?: string } };
    const txid = txResult.txid || txResult.transaction?.txID || "unknown";

    return {
      txid,
      route: {
        amountIn: result.trxSpent,
        amountOut: result.expectedTokens,
        symbols: ["TRX", "MEME"],
        poolVersions: ["sunpump"],
        impact: "N/A",
      },
      source: "sunpump",
    };
  } else {
    // MemeToken -> TRX (sell)
    const result = await sunpumpSell({
      tokenAddress: memeToken,
      tokenAmount: params.amountIn,
      slippage,
      network,
    });

    const txResult = result.txResult as { txid?: string; transaction?: { txID?: string } };
    const txid = txResult.txid || txResult.transaction?.txID || "unknown";

    return {
      txid,
      route: {
        amountIn: result.tokensSold,
        amountOut: result.expectedTrx,
        symbols: ["MEME", "TRX"],
        poolVersions: ["sunpump"],
        impact: "N/A",
      },
      source: "sunpump",
    };
  }
}

/**
 * Check if this is a TRX-TRC20 pair and the TRC20 token is trading on SunPump.
 * Returns the TRC20 token address if it's a SunPump trade, null otherwise.
 */
async function checkSunPumpTrade(
  tokenIn: string,
  tokenOut: string,
  network: string,
): Promise<{ isSunPump: boolean; isBuy: boolean; memeToken: string } | null> {
  const trxAddresses = [TRX_ADDRESS, TRX_ADDRESS.toLowerCase()];
  const isTokenInTrx = trxAddresses.includes(tokenIn);
  const isTokenOutTrx = trxAddresses.includes(tokenOut);

  // Must be TRX-TRC20 pair
  if (!isTokenInTrx && !isTokenOutTrx) {
    return null;
  }
  if (isTokenInTrx && isTokenOutTrx) {
    return null;
  }

  const memeToken = isTokenInTrx ? tokenOut : tokenIn;
  const isBuy = isTokenInTrx; // TRX -> Token is buy, Token -> TRX is sell

  try {
    const state = await getTokenState(memeToken, network);
    if (state === SunPumpTokenState.TRADING) {
      return { isSunPump: true, isBuy, memeToken };
    }
  } catch {
    // Token not on SunPump or query failed, use normal swap
  }

  return null;
}

export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  const network = params.network || "mainnet";
  const slippage = params.slippage ?? 0.005; // 0.5% default
  const constants = getSwapConstants(network);
  const testnet = network === "nile";

  // Check if this is a SunPump trade (TRX-MemeToken pair with token in TRADING state)
  const sunpumpCheck = await checkSunPumpTrade(params.tokenIn, params.tokenOut, network);

  if (sunpumpCheck?.isSunPump) {
    return executeSunPumpSwap(params, sunpumpCheck.isBuy, sunpumpCheck.memeToken, slippage);
  }

  // Normal Universal Router swap flow
  const wallet = getWallet();

  console.log(`wallet: ${wallet.type}`);

  const tronWeb = await wallet.getTronWeb(network);

  // 1. Fetch route from Router API
  const route = await fetchRouterAPI(
    {
      fromToken: params.tokenIn,
      toToken: params.tokenOut,
      amountIn: params.amountIn,
    },
    constants.routerApiUrl,
  );

  if (!route.data || route.data.length === 0) {
    throw new Error("No route found for the given token pair and amount");
  }

  const targetRoute = route.data[0];

  // 2. Permit2 flow (skip for native TRX)
  let permitSingleWithSignature: PermitSingleWithSignature | undefined;
  if (params.tokenIn !== constants.trx) {
    await ensureTokenAllowance({
      network,
      tokenAddress: params.tokenIn,
      spender: constants.permit2,
      requiredAmount: params.amountIn,
    });

    const permit2 = new AllowanceTransfer(tronWeb as any, constants.permit2, testnet);
    const now = Math.floor(Date.now() / 1000);
    const deadline = (now + 3600).toString();
    const sigDeadline = (now + 3600).toString();

    const { domain, permitSingle } = await permit2.generatePermitSignData(
      {
        owner: tronWeb.defaultAddress.base58 as string,
        token: params.tokenIn,
        amount: BigInt(params.amountIn),
        deadline,
      },
      constants.universalRouter,
      sigDeadline,
    );

    const rawSig = await wallet.signTypedData("PermitSingle", domain, PERMIT_TYPES, permitSingle as unknown as Record<string, unknown>);
    const signature = `0x${rawSig}` as `0x${string}`;

    permitSingleWithSignature = {
      signature,
      ...permitSingle,
    };
  }

  // 3. Parse route & build trade
  const swapTradeRoute = parseRouteAPIResponse(targetRoute, testnet, {
    slippage,
  } as ParseRouteOptions);

  const tradePlanner = new TradePlanner([swapTradeRoute], false, {
    permitOptions: {
      permitEnabled: !!permitSingleWithSignature,
      permit: permitSingleWithSignature,
    },
  });
  tradePlanner.encode();

  // 4. Build, sign, and broadcast via project standard flow
  const callValue = params.tokenIn === constants.trx ? params.amountIn : "0";
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const unsignedTx = await buildRawContractTx(tronWeb, {
    address: constants.universalRouter,
    functionSelector: "execute(bytes,bytes[],uint256)",
    parameter: [
      { type: "bytes", value: tradePlanner.commands },
      { type: "bytes[]", value: tradePlanner.inputs },
      { type: "uint256", value: deadline },
    ],
    callValue: Number(callValue),
    feeLimit: 500_000_000,
  });

  const result = (await signAndBroadcastContractTx(unsignedTx, network)) as any;

  return {
    txid: result.txid,
    route: {
      amountIn: targetRoute.amountIn,
      amountOut: targetRoute.amountOut,
      symbols: targetRoute.symbols,
      poolVersions: targetRoute.poolVersions,
      impact: targetRoute.impact,
    },
    source: "universal_router",
  };
}
