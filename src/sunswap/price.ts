import axios from "axios";

export interface TokenPriceRequest {
  tokenAddress?: string; // comma-separated list
  symbol?: string; // comma-separated list
}

export interface TokenPriceResponse {
  raw: any;
}

const SUN_IO_BASE_URL = "https://open.sun.io";

export async function getTokenPrices(params: TokenPriceRequest): Promise<TokenPriceResponse> {
  const url = `${SUN_IO_BASE_URL}/apiv2/price`;
  const response = await axios.get(url, {
    params: {
      tokenAddress: params.tokenAddress,
      symbol: params.symbol,
    },
  });

  return {
    raw: response.data,
  };
}
