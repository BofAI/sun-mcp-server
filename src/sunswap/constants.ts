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
// Native TRX and Wrapped TRX (for V2 pair lookups: pool is WTRX–Token)
// ---------------------------------------------------------------------------

/** Native TRX address (same on mainnet/Nile). Use this to trigger addLiquidityETH/removeLiquidityETH. */
export const TRX_ADDRESS = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

export const WTRX_MAINNET = "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR";
export const WTRX_NILE = "TYsbWxNnyTgsZaTFaue9hqpxkU3Fkco94a";

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
export const SUNSWAP_V3_MAINNET_POSITION_MANAGER = "TLSWrv7eC1AZCXkRjpqMZUmvgd99cj7pPF";

export const SUNSWAP_V3_NILE_FACTORY = "TLJWAScHZ4Qmk1axyKMzrnoYuu2pSLer1F";
export const SUNSWAP_V3_NILE_POSITION_MANAGER = "TPQzqHbCzQfoVdAV6bLwGDos8Lk2UjXz2R";

// ---------------------------------------------------------------------------
// SUNSwap V4 canonical contracts (mainnet + Nile)
// CLPositionManager: concentrated liquidity position manager
// ---------------------------------------------------------------------------

/** V4 CLPositionManager. Replace with deployed address when available. */
export const SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER = "TC8xQzPHfn5KceZV6s6GmZkBCFWWUoPXs1";
/** V4 CLPositionManager on Nile. Replace with deployed address when available. */
export const SUNSWAP_V4_NILE_CL_POSITION_MANAGER = "TMTQ1BYo15aGgZXHcsBWXyae8bVaAdgfLP";

/** V4 PoolManager. Replace with deployed address when available. */
export const SUNSWAP_V4_MAINNET_POOL_MANAGER = "TVjuTE3V5bMVdpfNhid8kD2v35T2k1u1Br";
/** V4 PoolManager on Nile. Replace with deployed address when available. */
export const SUNSWAP_V4_NILE_POOL_MANAGER = "TVivLPeq7FMmTG8Z7HaiBgHTsMwCEcipKT";

// ---------------------------------------------------------------------------
// Minimal ABIs used across SUNSwap helpers (V2/V3/V4 + TRC20)
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
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Minimal V2 factory ABI for getPair(tokenA, tokenB).
export const SUNSWAP_V2_FACTORY_MIN_ABI = [
  {
    constant: true,
    inputs: [{ type: "address" }, { type: "address" }],
    name: "getPair",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

// Minimal V3 NonfungiblePositionManager ABI for mint/increase/decrease/collect/positions.
// Avoids fetching the full on-chain ABI which contains types TronWeb v6 cannot parse.
export const SUNSWAP_V3_POSITION_MANAGER_MIN_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "token0", type: "address" },
          { name: "token1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "amount0Desired", type: "uint256" },
          { name: "amount1Desired", type: "uint256" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "mint",
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "liquidity", type: "uint128" },
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "amount0Desired", type: "uint256" },
          { name: "amount1Desired", type: "uint256" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "increaseLiquidity",
    outputs: [
      { name: "liquidity", type: "uint128" },
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "liquidity", type: "uint128" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "decreaseLiquidity",
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "amount0Max", type: "uint128" },
          { name: "amount1Max", type: "uint128" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "collect",
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "positions",
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// Minimal V4 CLPositionManager ABI.
// Uniswap-style V4 uses modifyLiquidities(bytes, uint256); SUNSWAP may keep V3-style interface.
// Use V3-style ABI if compatible; otherwise implement modifyLiquidities encoding.
export const SUNSWAP_V4_CL_POSITION_MANAGER_MIN_ABI = [
  {
    inputs: [
      { name: "unlockData", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    name: "modifyLiquidities",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getPoolAndPositionInfo",
    outputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
        name: "poolKey",
        type: "tuple",
      },
      {
        components: [
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "liquidity", type: "uint128" },
        ],
        name: "info",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getPositionLiquidity",
    outputs: [{ name: "liquidity", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
];

// Minimal V2 pair ABI for reserves / token ordering / totalSupply.
export const SUNSWAP_V2_PAIR_MIN_ABI = [
  {
    constant: true,
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "_reserve0", type: "uint112" },
      { name: "_reserve1", type: "uint112" },
      { name: "_blockTimestampLast", type: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];
