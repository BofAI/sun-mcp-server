import { TronWeb } from "tronweb";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { getNetworkConfig, DEFAULT_NETWORK } from "./chains";

export interface ConfiguredWallet {
  privateKey: string;
  address: string;
}

export interface AgentWalletProvider {
  /**
   * Return the primary address for this wallet on TRON (base58 or hex).
   */
  getAddress(): Promise<string> | string;

  /**
   * Sign and optionally broadcast a transaction blob created off-chain.
   * Implementations may broadcast internally and just return the tx hash.
   */
  signAndSendTransaction(unsignedTx: unknown): Promise<unknown>;
}

export type WalletContext =
  | {
      type: "local";
      tronWeb: TronWeb;
      privateKey: string;
      address: string;
      network: string;
    }
  | {
      type: "agent";
      provider: AgentWalletProvider;
      network: string;
    };

export interface GetWalletOptions {
  /**
   * Optional network name, defaults to TRON mainnet.
   */
  network?: string;

  /**
   * Optional AgentWallet provider injected by the host.
   * If present and no local private key/mnemonic is configured,
   * this provider will be used for signing + broadcasting.
   */
  provider?: AgentWalletProvider;
}

/**
 * Check if a local wallet is configured via environment variables.
 *
 * Configuration options (aligned with mcp-server-tron):
 * - TRON_PRIVATE_KEY: Hex private key (with or without 0x prefix)
 * - TRON_MNEMONIC: BIP-39 mnemonic phrase (12 or 24 words)
 * - TRON_ACCOUNT_INDEX: Optional account index for HD wallet derivation (default: 0)
 */
export const isLocalWalletConfigured = (): boolean => {
  return !!(process.env.TRON_PRIVATE_KEY || process.env.TRON_MNEMONIC);
};

export const getConfiguredLocalWallet = (): ConfiguredWallet => {
  const privateKey = process.env.TRON_PRIVATE_KEY;
  const mnemonic = process.env.TRON_MNEMONIC;
  const accountIndexStr = process.env.TRON_ACCOUNT_INDEX || "0";
  const accountIndex = parseInt(accountIndexStr, 10);

  if (isNaN(accountIndex) || accountIndex < 0 || !Number.isInteger(accountIndex)) {
    throw new Error(
      `Invalid TRON_ACCOUNT_INDEX: "${accountIndexStr}". Must be a non-negative integer.`,
    );
  }

  if (privateKey) {
    const cleanKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const address = TronWeb.address.fromPrivateKey(cleanKey);

    if (!address) {
      throw new Error("Invalid private key provided in TRON_PRIVATE_KEY");
    }

    return {
      privateKey: cleanKey,
      address,
    };
  }

  if (mnemonic) {
    if (!bip39.validateMnemonic(mnemonic, wordlist)) {
      throw new Error("Invalid mnemonic provided in TRON_MNEMONIC");
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const child = hdKey.derive(`m/44'/195'/0'/0/${accountIndex}`);

    if (!child.privateKey) {
      throw new Error("Failed to derive private key from mnemonic");
    }

    const privateKeyHex = Buffer.from(child.privateKey).toString("hex");
    const address = TronWeb.address.fromPrivateKey(privateKeyHex);

    return {
      privateKey: privateKeyHex,
      address: address as string,
    };
  }

  throw new Error(
    "Neither TRON_PRIVATE_KEY nor TRON_MNEMONIC environment variable is set. " +
      "Configure one of them to enable write operations, or provide an AgentWallet provider.",
  );
};

/**
 * Get a wallet context that prefers local env-based keys when available,
 * and falls back to an AgentWallet provider when configured.
 */
export const getWallet = (options: GetWalletOptions = {}): WalletContext => {
  const network = options.network || DEFAULT_NETWORK;

  if (isLocalWalletConfigured()) {
    const { privateKey, address } = getConfiguredLocalWallet();
    const config = getNetworkConfig(network);
    const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_GRID_API_KEY;

    const tronWeb = new TronWeb({
      fullHost: config.fullNode,
      solidityNode: config.solidityNode,
      eventServer: config.eventServer,
      privateKey,
      headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined,
    });

    return {
      type: "local",
      tronWeb,
      privateKey,
      address,
      network,
    };
  }

  if (options.provider) {
    return {
      type: "agent",
      provider: options.provider,
      network,
    };
  }

  throw new Error(
    "No wallet available. Configure TRON_PRIVATE_KEY / TRON_MNEMONIC for a local wallet or " +
      "provide an AgentWallet provider when calling getWallet.",
  );
};

export const getWalletAddress = async (options: GetWalletOptions = {}): Promise<string> => {
  const wallet = getWallet(options);

  if (wallet.type === "local") {
    return wallet.address;
  }

  const addr = await wallet.provider.getAddress();
  if (!addr) {
    throw new Error("AgentWallet provider returned an empty address");
  }
  return addr;
};

