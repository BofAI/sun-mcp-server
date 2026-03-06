import { getReadonlyTronWeb } from "./contracts";
import { getWalletAddress } from "./wallet";

export interface TokenBalanceRequest {
  address: string;
  type: "TRX" | "TRC20";
  tokenAddress?: string; // required for TRC20
}

export interface TokenBalanceResult {
  address: string;
  type: "TRX" | "TRC20";
  tokenAddress?: string;
  balance: string; // raw on-chain balance (Sun or token units)
}

export async function getBalances(params: {
  network?: string;
  ownerAddress?: string;
  tokens: TokenBalanceRequest[];
}): Promise<TokenBalanceResult[]> {
  const network = params.network || "mainnet";
  const owner =
    params.ownerAddress && params.ownerAddress.trim().length > 0
      ? params.ownerAddress
      : await getWalletAddress({ network });

  const tronWeb = await getReadonlyTronWeb(network);

  const results: TokenBalanceResult[] = [];

  for (const token of params.tokens) {
    if (token.type === "TRX") {
      const bal = await tronWeb.trx.getBalance(owner);
      results.push({
        address: owner,
        type: "TRX",
        balance: bal.toString(),
      });
      continue;
    }

    if (token.type === "TRC20") {
      if (!token.tokenAddress) {
        throw new Error("tokenAddress is required for TRC20 balance queries");
      }
      const contract = await tronWeb.contract().at(token.tokenAddress);
      const raw = await (contract as any).balanceOf(owner).call();
      results.push({
        address: owner,
        type: "TRC20",
        tokenAddress: token.tokenAddress,
        balance: raw.toString(),
      });
      continue;
    }
  }

  return results;
}

