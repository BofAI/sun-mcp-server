export enum TronNetwork {
  Mainnet = "mainnet",
  Nile = "nile",
  Shasta = "shasta",
}

export interface NetworkConfig {
  name: string;
  fullNode: string;
  solidityNode: string;
  eventServer: string;
}

export const NETWORKS: Record<TronNetwork, NetworkConfig> = {
  [TronNetwork.Mainnet]: {
    name: "Mainnet",
    fullNode: "https://api.trongrid.io",
    solidityNode: "https://api.trongrid.io",
    eventServer: "https://api.trongrid.io",
  },
  [TronNetwork.Nile]: {
    name: "Nile",
    fullNode: "https://nile.trongrid.io",
    solidityNode: "https://nile.trongrid.io",
    eventServer: "https://nile.trongrid.io",
  },
  [TronNetwork.Shasta]: {
    name: "Shasta",
    fullNode: "https://api.shasta.trongrid.io",
    solidityNode: "https://api.shasta.trongrid.io",
    eventServer: "https://api.shasta.trongrid.io",
  },
};

export const DEFAULT_NETWORK = TronNetwork.Mainnet;

export function getNetworkConfig(network: string = DEFAULT_NETWORK): NetworkConfig {
  const normalizedNetwork = network.toLowerCase();

  let baseConfig: NetworkConfig | undefined;

  if (Object.values(TronNetwork).includes(normalizedNetwork as TronNetwork)) {
    baseConfig = NETWORKS[normalizedNetwork as TronNetwork];
  } else if (
    normalizedNetwork === "tron" ||
    normalizedNetwork === "trx" ||
    normalizedNetwork === "mainnet"
  ) {
    baseConfig = NETWORKS[TronNetwork.Mainnet];
  } else if (normalizedNetwork === "testnet") {
    baseConfig = NETWORKS[TronNetwork.Nile];
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Allow overriding RPC endpoint via TRON_RPC_URL to align with agent-wallet.
  const overrideRpc = process.env.TRON_RPC_URL;
  if (overrideRpc) {
    return {
      ...baseConfig,
      fullNode: overrideRpc,
      solidityNode: overrideRpc,
      eventServer: overrideRpc,
    };
  }

  return baseConfig;
}

