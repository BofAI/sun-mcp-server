# API Reference

## OpenAPI-Generated Tools

These tools are auto-generated from `specs/sunio-open-api.json`:

### Transactions
- `scanTransactions` — scan DEX transactions by protocol, token/pool, type, and time range

### Tokens
- `getTokens` — fetch tokens by address and protocol
- `searchTokens` — fuzzy token search by keyword

### Protocols
- `getProtocol` — protocol snapshot data
- `getVolHistory` — protocol volume history
- `getUsersCountHistory` — protocol users history
- `getTransactionsHistory` — protocol transaction count history
- `getPoolsCountHistory` — protocol pool count history
- `getLiqHistory` — protocol liquidity history

### Prices
- `getPrice` — token price query

### Positions
- `getUserPositions` — user liquidity positions
- `getPoolUserPositionTick` — pool tick-level position details

### Pools
- `getPools` — fetch pools by address, token, or protocol
- `getTopApyPoolList` — paginated top APY pools
- `searchPools` — pool search
- `searchCountPools` — pool search count
- `getPoolHooks` — pool hooks list
- `getPoolVolHistory` — pool volume history
- `getPoolLiqHistory` — pool liquidity history

### Pairs
- `getPairsFromEntity` — token pair entity query

### Farms
- `getFarms` — farming pool list
- `getFarmTransactions` — farm transaction scanning
- `getFarmPositions` — user farming positions

---

## SUNSWAP Tools

### sunswap_get_wallet_address

Get the active TRON wallet address.

**Parameters:**
- `network` (optional): `mainnet` | `nile` | `shasta` (default: `mainnet`)

---

### sunswap_get_balances

Get TRX and TRC20 balances.

**Parameters:**
- `network` (optional)
- `ownerAddress` (optional): defaults to active wallet
- `tokens`: array of `{ type: "TRX" | "TRC20", tokenAddress?: string }`

---

### sunswap_get_token_price

Get token prices from SUN.IO API.

**Parameters:**
- `tokenAddress` (optional): comma-separated addresses
- `symbol` (optional): comma-separated symbols

---

### sunswap_swap

High-level token swap via Universal Router.

**Parameters:**
- `tokenIn`: input token address
- `tokenOut`: output token address
- `amountIn`: raw amount
- `network` (optional)
- `slippage` (optional): decimal, default 0.005

---

### sunswap_v2_add_liquidity

Add V2 liquidity. Auto-detects TRX and uses `addLiquidityETH`. Computes optimal amounts from pool reserves.

**Parameters:**
- `network` (optional)
- `routerAddress`: V2 router
- `tokenA`, `tokenB`: token addresses
- `amountADesired`, `amountBDesired`: raw amounts
- `amountAMin`, `amountBMin` (optional): auto with 5% slippage
- `to` (optional): defaults to wallet
- `deadline` (optional): defaults to now + 30 min

---

### sunswap_v2_remove_liquidity

Remove V2 liquidity. Auto-discovers LP pair. Supports TRX via `removeLiquidityETH`.

**Parameters:**
- `network` (optional)
- `routerAddress`: V2 router
- `tokenA`, `tokenB`: underlying token addresses
- `liquidity`: LP amount to burn
- `amountAMin`, `amountBMin` (optional): auto from reserves with 5% slippage
- `to` (optional): defaults to wallet
- `deadline` (optional): defaults to now + 30 min

---

### sunswap_v3_mint_position

Create a new V3 concentrated liquidity position with full auto-compute support.

**Parameters:**
- `network` (optional)
- `positionManagerAddress`: V3 position manager
- `token0`, `token1`: token addresses
- `fee` (optional): pool fee tier, default 3000
- `tickLower` (optional): auto from currentTick − 50×tickSpacing
- `tickUpper` (optional): auto from currentTick + 50×tickSpacing
- `amount0Desired` (optional): if only this is provided, amount1 is auto-computed
- `amount1Desired` (optional): if only this is provided, amount0 is auto-computed
- `amount0Min`, `amount1Min` (optional): auto with 5% slippage
- `recipient` (optional): defaults to wallet
- `deadline` (optional): defaults to now + 30 min

**Returns:**
```json
{
  "txResult": { ... },
  "computedAmounts": { "amount0Desired": "...", "amount1Desired": "..." },
  "computedTicks": { "tickLower": -3000, "tickUpper": 3000 }
}
```

**Minimal example** — only token0 amount + auto everything:
```json
{
  "positionManagerAddress": "TPQzqHbCzQfoVdAV6bLwGDos8Lk2UjXz2R",
  "token0": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
  "token1": "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK",
  "amount0Desired": "1000000",
  "network": "nile"
}
```

---

### sunswap_v3_increase_liquidity

Add tokens to an existing V3 position. Supports single-sided auto-compute.

**Parameters:**
- `network` (optional)
- `positionManagerAddress`
- `tokenId`: position NFT ID
- `token0`, `token1` (optional): needed for single-sided auto-compute and approval
- `fee` (optional): default 3000
- `amount0Desired` (optional)
- `amount1Desired` (optional)
- `amount0Min`, `amount1Min` (optional): auto with 5% slippage
- `deadline` (optional): defaults to now + 30 min

---

### sunswap_v3_decrease_liquidity

Remove liquidity from a V3 position. Auto-computes amountMin from V3 math.

**Parameters:**
- `network` (optional)
- `positionManagerAddress`
- `tokenId`: position NFT ID
- `liquidity`: amount to burn
- `token0`, `token1` (optional): enables auto amountMin
- `fee` (optional): default 3000
- `amount0Min`, `amount1Min` (optional): auto from `getAmountsForLiquidity` × 95%
- `deadline` (optional): defaults to now + 30 min

---

### sunswap_v3_collect

Collect accrued trading fees from a V3 position. Estimates fees before executing.

**Parameters:**
- `network` (optional)
- `positionManagerAddress`
- `tokenId`: position NFT ID
- `recipient` (optional): defaults to wallet

**Returns:**
```json
{
  "estimatedFees": { "amount0": "12345", "amount1": "67890" },
  "txResult": { ... }
}
```

---

### sunswap_read_contract

Read view/pure contract functions.

**Parameters:**
- `network` (optional)
- `address`: contract address
- `functionName`: function name
- `args` (optional)
- `abi` (optional)

---

### sunswap_send_contract

Send state-changing contract transactions.

**Parameters:**
- `network` (optional)
- `address`: contract address
- `functionName`: function name
- `args` (optional)
- `value` (optional): TRX in Sun
- `abi` (optional)
