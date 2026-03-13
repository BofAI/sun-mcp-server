# Features

## Read-Only API Surface

Auto-generated from the SUN.IO OpenAPI spec:

- **Transactions**: scan swap/add/withdraw activity with pagination
- **Tokens**: fetch metadata, fuzzy search
- **Protocols**: snapshots, volume/liquidity/user/transaction history
- **Prices**: real-time token prices
- **Positions**: user LP positions, tick-level data
- **Pools**: list, search, top APY pools, hooks, volume/liquidity history
- **Pairs**: token pair entity queries
- **Farms**: farming pool list, transaction scanning, user farm positions

## SUNSWAP Execution Tools

### Wallet & Balances

- `sunswap_get_wallet_address` — active TRON wallet address
- `sunswap_get_balances` — TRX and TRC20 balances

### Pricing & Quoting

- `sunswap_get_token_price` — token prices from SUN.IO API
- `sunswap_quote_exact_input` — smart router swap estimates

### Swaps

- `sunswap_swap` — high-level Universal Router swap (tokenIn, tokenOut, amountIn)
- `sunswap_swap_exact_input` — low-level router swap with full control

### V2 Liquidity

- `sunswap_v2_add_liquidity` — add V2 liquidity with:
  - Automatic TRC20 approval management
  - Adaptive optimal amounts (`computeOptimalAmounts`)
  - Native TRX support (`addLiquidityETH`)
  - Auto slippage (5%) and deadline (30 min)
- `sunswap_v2_remove_liquidity` — remove V2 liquidity with:
  - Automatic LP pair discovery from factory
  - Native TRX support (`removeLiquidityETH`)
  - Auto `amountMin` from pool reserves with slippage

### V3 Liquidity

All V3 tools feature intelligent auto-compute:

| Parameter | Mint | Increase | Decrease |
|-----------|------|----------|----------|
| `fee` | Default 3000 | Default 3000 | Default 3000 |
| `tickLower`/`tickUpper` | Auto: currentTick ± 50×tickSpacing | From position | N/A |
| Single-sided input | Auto-compute other side via V3 math | Same (needs token0/token1/fee) | N/A |
| `amountMin` | desired × 95% | desired × 95% | From `getAmountsForLiquidity` × 95% |
| `recipient` | Default: wallet | N/A | N/A |
| `deadline` | Default: now + 30 min | Same | Same |

- `sunswap_v3_mint_position` — create new concentrated liquidity position
- `sunswap_v3_increase_liquidity` — add to existing position
- `sunswap_v3_decrease_liquidity` — remove from existing position
- `sunswap_v3_collect` — collect accrued trading fees with pre-estimation

### Generic Contract Tools

- `sunswap_read_contract` — read view/pure functions
- `sunswap_send_contract` — send state-changing transactions

## Developer Test Scripts

For local, scriptable testing of the SUNSWAP tools and flows, the repo includes several helper scripts:

- **V2 Liquidity**
  - `npm run script:test-add-liquidity`
  - `npm run script:test-remove-liquidity`
- **V3 Liquidity**
  - `npm run script:test-v3-mint`
  - `npm run script:test-v3-increase`
  - `npm run script:test-v3-decrease`
  - `npm run script:test-v3-collect`
- **V4 Liquidity**
  - `npm run script:test-v4-mint`
  - `npm run script:test-v4-increase`
  - `npm run script:test-v4-decrease`
  - `npm run script:test-v4-collect`
- **SunPump / High-Level Swap**
  - `npm run script:test-sunpump-buy`
  - `npm run script:test-sunpump-sell`
  - `npm run script:test-sunpump-swap`
- **OpenAPI / SUN.IO API**
  - `npm run script:test-openapi` (add `-- --fetch` to hit `GET /apiv2/price`)
- **Aggregated SUNSWAP Tools**
  - `npm run script:test-sunswap-tools` — exercises wallet, balances, prices, read-contract, and (optionally) router-based quote/swap and `sunswap_send_contract` via environment flags.

These scripts are intended for maintainers and integrators who want end-to-end validation against real TRON networks.

## V3 Math Engine

The server includes a built-in V3 math engine (`src/sunswap/v3Math.ts`) ported from Uniswap V3 Solidity:

- `getSqrtRatioAtTick` — TickMath.getSqrtRatioAtTick
- `maxLiquidityForAmounts` — compute max liquidity from token amounts
- `getAmountsForLiquidity` — compute token amounts from liquidity
- `nearestUsableTick` — snap tick to valid tickSpacing boundary

## V3 Pool Reader

`src/sunswap/v3Pool.ts` reads live pool state from the V3 factory:

- Resolves pool address from token pair + fee via factory.getPool
- Reads slot0 (sqrtPriceX96, currentTick), liquidity, and tickSpacing
