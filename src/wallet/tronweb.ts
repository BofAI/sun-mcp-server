/**
 * Lightweight read-only TronWeb factory.
 *
 * Provides a TronWeb instance that can perform view/constant calls but
 * has no private key attached.  Used by both the wallet layer and
 * sunswap helpers that only need to read on-chain state.
 */

import type { TronWeb } from "tronweb";
import { getNetworkConfig } from "../sunswap/chains";

export async function getReadonlyTronWeb(network: string): Promise<TronWeb> {
  const tronwebModule = await import("tronweb");
  const m = tronwebModule as any;
  // CJS build: default is an object; the class is m.TronWeb. ESM may use default.
  const TronWebCtor =
    m.TronWeb ?? (typeof m.default === "function" ? m.default : null);
  if (typeof TronWebCtor !== "function") {
    throw new Error(
      "Unable to load TronWeb constructor from 'tronweb' module",
    );
  }

  const config = getNetworkConfig(network);
  const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_GRID_API_KEY;

  const tw = new TronWebCtor({
    fullHost: config.fullNode,
    solidityNode: config.solidityNode,
    eventServer: config.eventServer,
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined,
  }) as TronWeb;

  // Constant/view calls require owner_address; use zero address for read-only.
  const zeroHex = "410000000000000000000000000000000000000000";
  const zeroBase58 = (tw as any).address?.fromHex?.(zeroHex) ?? zeroHex;
  (tw as any).defaultAddress = { hex: zeroHex, base58: zeroBase58 };

  return tw;
}
