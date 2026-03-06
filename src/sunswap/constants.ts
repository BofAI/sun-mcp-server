export interface NetworkConstants {
  trx: string;
}

export interface SwapConstants extends NetworkConstants {
  universalRouter: string;
  permit2: string;
  routerApiUrl: string;
}

// ---------------------------------------------------------------------------
// Network-level swap/router constants (Universal Router + Permit2)
// ---------------------------------------------------------------------------

export const MAINNET: SwapConstants = {
  universalRouter: "TSJEtPuqHpvSaVnSwvCsngaeBxrGUzp95Q",
  permit2: "TTJxU3P8rHycAyFY4kVtGNfmnMH4ezcuM9",
  routerApiUrl: "https://rot.endjgfsv.link",
  trx: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
};

export const NILE: SwapConstants = {
  universalRouter: "TEgq4237arNE7jX74KCDkc1MXdZeWNkGVj",
  permit2: "TYQuuhGbEMxF7nZxUHV3uHJxAVVAegNU9h",
  routerApiUrl: "https://tnrouter.endjgfsv.link",
  trx: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
};

export const SHASTA: NetworkConstants = {
  trx: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
};

// ---------------------------------------------------------------------------
// SUNSwap V2 canonical contracts (mainnet + Nile)
// ---------------------------------------------------------------------------

export const SUNSWAP_V2_MAINNET_FACTORY = "TKWJdrQkqHisa1X8HUdHEfREvTzw4pMAaY";
export const SUNSWAP_V2_MAINNET_ROUTER = "TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax";

export const SUNSWAP_V2_NILE_FACTORY = "THomLGMLhAjMecQf9FQjbZ8a1RtwsZLrGE";
export const SUNSWAP_V2_NILE_ROUTER = "TMn1qrmYUMSTXo9babrJLzepKZoPC7M6Sy";

// ---------------------------------------------------------------------------
// SUNSwap V3 canonical contracts (mainnet + Nile)
// ---------------------------------------------------------------------------

export const SUNSWAP_V3_MAINNET_FACTORY = "TThJt8zaJzJMhCEScH7zWKnp5buVZqys9x";
export const SUNSWAP_V3_MAINNET_POSITION_MANAGER =
  "TLSWrv7eC1AZCXkRjpqMZUmvgd99cj7pPF";

export const SUNSWAP_V3_NILE_FACTORY = "TLJWAScHZ4Qmk1axyKMzrnoYuu2pSLer1F";
export const SUNSWAP_V3_NILE_POSITION_MANAGER =
  "TPQzqHbCzQfoVdAV6bLwGDos8Lk2UjXz2R";

// ---------------------------------------------------------------------------
// Minimal ABIs used across SUNSwap helpers (V2/V3 + TRC20)
// ---------------------------------------------------------------------------

// Minimal TRC20 ABI (allowance / balanceOf / approve) taken from
// resources/liquidity_manager_contracts.json.
export const TRC20_MIN_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Minimal V2 factory ABI for getPair(tokenA, tokenB).
export const SUNSWAP_V2_FACTORY_MIN_ABI = [
  {
    constant: true,
    inputs: [
      { type: "address" },
      { type: "address" },
    ],
    name: "getPair",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

