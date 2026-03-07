import { sendContractTx, ensureTokenAllowance, getReadonlyTronWeb } from "./contracts";
import type { AgentWalletProvider } from "./wallet";
import { getWalletAddress } from "./wallet";
import {
  SUNSWAP_V2_FACTORY_MIN_ABI,
  SUNSWAP_V2_MAINNET_FACTORY,
  SUNSWAP_V2_NILE_FACTORY,
  SUNSWAP_V2_PAIR_MIN_ABI,
  TRX_ADDRESS,
  WTRX_MAINNET,
  WTRX_NILE,
} from "./constants";

const DEFAULT_SLIPPAGE_BPS = 500; // 5%

function applySlippage(amount: string): string {
  const raw = BigInt(amount || "0");
  if (raw === BigInt(0)) return "0";
  const factor = BigInt(10_000 - DEFAULT_SLIPPAGE_BPS);
  return (raw * factor / BigInt(10_000)).toString();
}

/** True if the address is native TRX (used for addLiquidityETH/removeLiquidityETH). */
function isTRX(tokenAddress: string): boolean {
  return tokenAddress === TRX_ADDRESS;
}

/** WTRX address for the network; used for factory.getPair when one side is TRX. */
function getWTRXForNetwork(network: string): string {
  const n = network.toLowerCase();
  if (n === "mainnet" || n === "tron" || n === "trx") return WTRX_MAINNET;
  if (n === "nile" || n === "testnet") return WTRX_NILE;
  throw new Error(`Unsupported network for WTRX: ${network}`);
}

/** For pair lookup: TRX is not an ERC20, use WTRX. */
function getPairLookupToken(tokenAddress: string, network: string): string {
  return isTRX(tokenAddress) ? getWTRXForNetwork(network) : tokenAddress;
}

export interface AddLiquidityV2Params {
  network?: string;
  routerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin?: string;
  amountBMin?: string;
  to?: string;
  deadline?: string | number;
}

export interface RemoveLiquidityV2Params {
  network?: string;
  routerAddress: string;
  abi?: any[];
  provider?: AgentWalletProvider;

  tokenA: string;
  tokenB: string;
  liquidity: string;
  amountAMin?: string;
  amountBMin?: string;
  to?: string;
  deadline?: string | number;
}

interface V2PairInfo {
  pairAddress: string;
  reserveA: string;
  reserveB: string;
  totalSupply: string;
}

async function getV2PairInfo(
  network: string,
  tokenA: string,
  tokenB: string,
): Promise<V2PairInfo> {
  const tronWeb = await getReadonlyTronWeb(network);
  const normalized = network.toLowerCase();

  let factoryAddress: string;
  if (normalized === "mainnet" || normalized === "tron" || normalized === "trx") {
    factoryAddress = SUNSWAP_V2_MAINNET_FACTORY;
  } else if (normalized === "nile" || normalized === "testnet") {
    factoryAddress = SUNSWAP_V2_NILE_FACTORY;
  } else {
    throw new Error(`Unsupported network for SUNSWAP V2 factory: ${network}`);
  }

  const lookupA = getPairLookupToken(tokenA, network);
  const lookupB = getPairLookupToken(tokenB, network);

  const factory = await tronWeb.contract(
    SUNSWAP_V2_FACTORY_MIN_ABI as any,
    factoryAddress,
  );
  const pairHex = await factory.getPair(lookupA, lookupB).call();
  const pairBase58 = tronWeb.address.fromHex(pairHex);

  const zeroBase58 = tronWeb.address.fromHex(
    "410000000000000000000000000000000000000000",
  );
  if (!pairBase58 || pairBase58 === zeroBase58) {
    throw new Error("Pool does not exist for this token pair.");
  }

  const pair = await tronWeb.contract(SUNSWAP_V2_PAIR_MIN_ABI as any, pairBase58);
  const reserves = await pair.getReserves().call();
  const token0Hex = await pair.token0().call();
  const token1Hex = await pair.token1().call();
  const totalSupply = await pair.totalSupply().call();

  const token0 = tronWeb.address.fromHex(token0Hex);
  const token1 = tronWeb.address.fromHex(token1Hex);

  const reserve0 = (reserves._reserve0 ?? reserves[0]).toString();
  const reserve1 = (reserves._reserve1 ?? reserves[1]).toString();

  const reserveA = token0 === lookupA ? reserve0 : reserve1;
  const reserveB = token0 === lookupB ? reserve0 : reserve1;

  return {
    pairAddress: pairBase58,
    reserveA,
    reserveB,
    totalSupply: totalSupply.toString(),
  };
}

export async function addLiquidityV2(params: AddLiquidityV2Params): Promise<unknown> {
  const network = params.network || "mainnet";

  const amountADesired = params.amountADesired;
  const amountBDesired = params.amountBDesired;

  const amountAMin =
    params.amountAMin ?? applySlippage(amountADesired);
  const amountBMin =
    params.amountBMin ?? applySlippage(amountBDesired);

  const to =
    params.to ??
    await getWalletAddress({
      network,
      provider: params.provider,
    });

  const deadline =
    params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60; // +30 minutes

  const hasTRX = isTRX(params.tokenA) || isTRX(params.tokenB);

  if (hasTRX) {
    const otherToken = isTRX(params.tokenA) ? params.tokenB : params.tokenA;
    const otherAmount = isTRX(params.tokenA) ? amountBDesired : amountADesired;
    const otherMin = isTRX(params.tokenA) ? amountBMin : amountAMin;
    const trxAmount = isTRX(params.tokenA) ? amountADesired : amountBDesired;
    const trxMin = isTRX(params.tokenA) ? amountAMin : amountBMin;

    await ensureTokenAllowance({
      network,
      tokenAddress: otherToken,
      spender: params.routerAddress,
      requiredAmount: otherAmount,
      provider: params.provider,
    });

    return sendContractTx({
      address: params.routerAddress,
      functionName: "addLiquidityETH",
      args: [otherToken, otherAmount, otherMin, trxMin, to, deadline],
      abi: params.abi,
      network,
      provider: params.provider,
      value: trxAmount,
    });
  }

  await ensureTokenAllowance({
    network,
    tokenAddress: params.tokenA,
    spender: params.routerAddress,
    requiredAmount: params.amountADesired,
    provider: params.provider,
  });

  await ensureTokenAllowance({
    network,
    tokenAddress: params.tokenB,
    spender: params.routerAddress,
    requiredAmount: amountBDesired,
    provider: params.provider,
  });

  const args = [
    params.tokenA,
    params.tokenB,
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    to,
    deadline,
  ];

  return sendContractTx({
    address: params.routerAddress,
    functionName: "addLiquidity",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });
}

export async function removeLiquidityV2(params: RemoveLiquidityV2Params): Promise<unknown> {
  const network = params.network || "mainnet";

  const to =
    params.to ??
    await getWalletAddress({
      network,
      provider: params.provider,
    });

  const deadline =
    params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60; // +30 minutes

  // Discover LP token (pair) and on-chain reserves for this token pair.
  const pairInfo = await getV2PairInfo(network, params.tokenA, params.tokenB);

  // For V2 remove, the input token for allowance is the LP token (pair).
  await ensureTokenAllowance({
    network,
    tokenAddress: pairInfo.pairAddress,
    spender: params.routerAddress,
    requiredAmount: params.liquidity,
    provider: params.provider,
  });

  let amountAMin = params.amountAMin;
  let amountBMin = params.amountBMin;

  if (!amountAMin || !amountBMin) {
    const totalSupply = BigInt(pairInfo.totalSupply || "0");
    const liquidity = BigInt(params.liquidity);

    if (totalSupply === BigInt(0)) {
      amountAMin = amountAMin ?? "0";
      amountBMin = amountBMin ?? "0";
    } else {
      const expectedA = (liquidity * BigInt(pairInfo.reserveA) / totalSupply).toString();
      const expectedB = (liquidity * BigInt(pairInfo.reserveB) / totalSupply).toString();

      if (!amountAMin) {
        amountAMin = applySlippage(expectedA);
      }
      if (!amountBMin) {
        amountBMin = applySlippage(expectedB);
      }
    }
  }

  const hasTRX = isTRX(params.tokenA) || isTRX(params.tokenB);

  if (hasTRX) {
    const otherToken = isTRX(params.tokenA) ? params.tokenB : params.tokenA;
    const amountTokenMin = isTRX(params.tokenA) ? (amountBMin ?? "0") : (amountAMin ?? "0");
    const amountETHMin = isTRX(params.tokenA) ? (amountAMin ?? "0") : (amountBMin ?? "0");

    return sendContractTx({
      address: params.routerAddress,
      functionName: "removeLiquidityETH",
      args: [otherToken, params.liquidity, amountTokenMin, amountETHMin, to, deadline],
      abi: params.abi,
      network,
      provider: params.provider,
    });
  }

  const args = [
    params.tokenA,
    params.tokenB,
    params.liquidity,
    amountAMin ?? "0",
    amountBMin ?? "0",
    to,
    deadline,
  ];

  return sendContractTx({
    address: params.routerAddress,
    functionName: "removeLiquidity",
    args,
    abi: params.abi,
    network,
    provider: params.provider,
  });
}

