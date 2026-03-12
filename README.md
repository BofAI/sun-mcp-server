# SUN MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Network](https://img.shields.io/badge/Network-TRON-red)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)

An MCP server focused on the SUN.IO (SUNSWAP) ecosystem. This project currently exposes the SUN.IO API surface defined in `specs/sunio-open-api.json`, allowing AI clients to comprehensively query TRON DEX ecosystem data (including tokens, pools, prices, protocol metrics, transactions, farming, contracts, and chain status). In the future, the server will expand beyond read-only access to support core DeFi execution capabilities, such as liquidity management and token swapping operations.

An MCP server for AI-driven DeFi operations on the TRON network through the SUN.IO / SUNSWAP ecosystem.

## Contents

- [Overview](#overview)
- [Supported SUN.IO API Domains](#supported-sunio-api-domains)
- [API Reference (from `sunio-open-api.json`)](#api-reference-from-sunio-open-apijson)
- [SUNSWAP Tools Reference](#sunswap-tools-reference)
  - [Wallet Tools](#wallet-tools)
  - [Pricing & Quoting Tools](#pricing--quoting-tools)
  - [Swap Tools](#swap-tools)
  - [V2 Liquidity Tools](#v2-liquidity-tools)
  - [V3 Liquidity Tools](#v3-liquidity-tools)
  - [V4 Liquidity Tools](#v4-liquidity-tools)
  - [Generic Contract Tools](#generic-contract-tools)
  - [Auto-Compute Features Summary](#auto-compute-features-summary)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Client Integration](#client-integration)
- [Security Considerations](#security-considerations)
- [License](#license)

## Overview

This repository is preconfigured to serve SUN.IO API capabilities from `https://sun.io`.

Primary use cases:

- Analyze token and pool market activity on SUN.IO.
- Track protocol-level trends (volume, liquidity, users, transaction count, pool count).
- Inspect user LP/farming positions and farm transaction history.
- Discover contracts and monitor latest chain block context.
- Use hand-written SUNSWAP tools (`sunswap_*`) for wallet inspection, quoting swaps, liquidity management, and other on-chain contract interactions.

## Supported SUN.IO API Domains

- **Transactions**: scan swap/add/withdraw activity with pagination.
- **Tokens**: fetch token metadata, search tokens.
- **Protocols**: fetch protocol snapshots and historical KPI series.
- **Prices**: fetch token price by address.
- **Positions**: query user liquidity positions and tick-level data.
- **Pools**: list/search pools, fetch top APY pools, hooks, and pool history.
- **Pairs**: query token pair information.
- **Farms**: list farms, scan farm transactions, query user farm positions.

## API Reference (from `sunio-open-api.json`)

### Transactions

- `scanTransactions` (`GET /apiv2/transactions/scan`): scan DEX transactions by protocol, token/pool, type, and time range.

### Tokens

- `getTokens` (`GET /apiv2/tokens`): fetch tokens by address and protocol.
- `searchTokens` (`GET /apiv2/tokens/search`): fuzzy token search by keyword.

### Protocols

- `getProtocol` (`GET /apiv2/protocols`): protocol snapshot data.
- `getVolHistory` (`GET /apiv2/protocols/history/vol`): protocol volume history.
- `getUsersCountHistory` (`GET /apiv2/protocols/history/usersCount`): protocol users history.
- `getTransactionsHistory` (`GET /apiv2/protocols/history/transactions`): protocol transaction count history.
- `getPoolsCountHistory` (`GET /apiv2/protocols/history/poolsCount`): protocol pool count history.
- `getLiqHistory` (`GET /apiv2/protocols/history/liq`): protocol liquidity history.

### Prices

- `getPrice` (`GET /apiv2/price`): token price query.

### Positions

- `getUserPositions` (`GET /apiv2/positions/user`): user liquidity positions.
- `getPoolUserPositionTick` (`GET /apiv2/positions/tick`): pool tick-level position/liquidity details.

### Pools

- `getPools` (`GET /apiv2/pools`): fetch pools by address, token, or protocol.
- `getTopApyPoolList` (`GET /apiv2/pools/top_apy_list`): paginated top APY pools.
- `searchPools` (`GET /apiv2/pools/search`): pool search endpoint.
- `searchCountPools` (`GET /apiv2/pools/search/count`): pool search count endpoint.
- `getPoolHooks` (`GET /apiv2/pools/hooks`): pool hooks list.
- `getPoolVolHistory` (`GET /apiv2/pools/history/vol`): pool volume history.
- `getPoolLiqHistory` (`GET /apiv2/pools/history/liq`): pool liquidity history.

### Pairs

- `getPairsFromEntity` (`GET /apiv2/pairs`): token pair entity query.

### Farms

- `getFarms` (`GET /apiv2/farms`): farming pool list.
- `getFarmTransactions` (`GET /apiv2/farms/transactions`): farm transaction scanning.
- `getFarmPositions` (`GET /apiv2/farms/positions/user`): user farming positions.

### SUNSWAP Tools Reference

The server exposes a comprehensive set of tools for DeFi operations. All tools are accessible via MCP protocol or HTTP (when running in `streamable-http` mode).

---

## Wallet Tools

### `sunswap_get_wallet_address`

Get the active TRON wallet address.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network: `mainnet`, `nile`, or `shasta`. Default: `mainnet` |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_get_wallet_address",
      "arguments": { "network": "mainnet" }
    }
  }'
```

### `sunswap_list_wallets`

List all available wallets (agent-wallet mode only).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | - | - | No parameters required |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { "name": "sunswap_list_wallets", "arguments": {} }
  }'
```

### `sunswap_select_wallet`

Switch the active wallet (agent-wallet mode only).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletId` | string | Yes | The wallet ID to switch to |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_select_wallet",
      "arguments": { "walletId": "my-wallet" }
    }
  }'
```

### `sunswap_get_balances`

Get TRX and TRC20 balances for a wallet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `ownerAddress` | string | No | Wallet address. Defaults to active wallet |
| `tokens` | array | Yes | Array of token queries: `[{ type: "TRX" }]` or `[{ type: "TRC20", tokenAddress: "..." }]` |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_get_balances",
      "arguments": {
        "network": "mainnet",
        "tokens": [
          { "type": "TRX" },
          { "type": "TRC20", "tokenAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" }
        ]
      }
    }
  }'
```

---

## Pricing & Quoting Tools

### `sunswap_get_token_price`

Get token prices from SUN.IO API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | No | Comma-separated token addresses |
| `symbol` | string | No | Comma-separated token symbols (e.g., `SUN,TRX,USDT`) |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_get_token_price",
      "arguments": { "symbol": "TRX,USDT,SUN" }
    }
  }'
```

### `sunswap_quote_exact_input`

Get swap quote from the smart router.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `routerAddress` | string | Yes | Smart router contract address |
| `functionName` | string | No | Quote function name. Default: `quoteExactInput` |
| `args` | array | Yes | Arguments for the router quote function |
| `abi` | array | No | Optional router ABI |

---

## Swap Tools

### `sunswap_swap` ⭐ (Recommended)

Execute a token swap via Universal Router. **Simplest way to swap** - automatically finds best route and handles Permit2.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenIn` | string | Yes | Input token address (base58). Use `T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb` for TRX |
| `tokenOut` | string | Yes | Output token address (base58) |
| `amountIn` | string | Yes | Amount in raw units (e.g., `1000000` = 1 USDT with 6 decimals) |
| `network` | string | No | TRON network. Default: `mainnet` |
| `slippage` | number | No | Slippage tolerance (0.005 = 0.5%). Default: `0.005` |

**curl Example - Swap 10 TRX to USDT:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_swap",
      "arguments": {
        "tokenIn": "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
        "tokenOut": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "amountIn": "10000000",
        "network": "mainnet",
        "slippage": 0.01
      }
    }
  }'
```

### `sunswap_swap_exact_input`

Low-level router swap with full control.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `routerAddress` | string | Yes | Smart router contract address |
| `functionName` | string | No | Swap function name. Default: `swapExactInput` |
| `args` | array | Yes | Arguments for the router swap function |
| `value` | string | No | TRX amount in Sun to attach |
| `abi` | array | No | Optional router ABI |

---

## V2 Liquidity Tools

### `sunswap_v2_add_liquidity`

Add liquidity to a SUNSWAP V2 pool. Automatically handles TRX via `addLiquidityETH`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `routerAddress` | string | Yes | V2 router contract address |
| `abi` | array | No | Optional router ABI |
| `tokenA` | string | Yes | Token A contract address |
| `tokenB` | string | Yes | Token B contract address |
| `amountADesired` | string | Yes | Desired amount of token A (raw units) |
| `amountBDesired` | string | Yes | Desired amount of token B (raw units) |
| `amountAMin` | string | No | Min token A. Default: 5% slippage |
| `amountBMin` | string | No | Min token B. Default: 5% slippage |
| `to` | string | No | LP token recipient. Default: active wallet |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_v2_add_liquidity",
      "arguments": {
        "network": "mainnet",
        "routerAddress": "TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax",
        "tokenA": "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
        "tokenB": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "amountADesired": "10000000",
        "amountBDesired": "10000000"
      }
    }
  }'
```

### `sunswap_v2_remove_liquidity`

Remove liquidity from a SUNSWAP V2 pool.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `routerAddress` | string | Yes | V2 router contract address |
| `abi` | array | No | Optional router ABI |
| `tokenA` | string | Yes | Token A address |
| `tokenB` | string | Yes | Token B address |
| `liquidity` | string | Yes | Amount of LP tokens to burn |
| `amountAMin` | string | No | Min token A to receive |
| `amountBMin` | string | No | Min token B to receive |
| `to` | string | No | Recipient. Default: active wallet |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

---

## V3 Liquidity Tools

### `sunswap_v3_mint_position`

Mint a new V3 concentrated liquidity position with **auto-compute** features.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `positionManagerAddress` | string | Yes | V3 NonfungiblePositionManager address |
| `abi` | array | No | Optional position manager ABI |
| `token0` | string | Yes | Token0 contract address |
| `token1` | string | Yes | Token1 contract address |
| `fee` | number | No | Pool fee tier (100, 500, 3000, 10000). Default: `3000` |
| `tickLower` | number | No | Lower tick. Auto: currentTick - 50×tickSpacing |
| `tickUpper` | number | No | Upper tick. Auto: currentTick + 50×tickSpacing |
| `amount0Desired` | string | No* | Desired token0 amount. *At least one amount required |
| `amount1Desired` | string | No* | Desired token1 amount. *At least one amount required |
| `amount0Min` | string | No | Min token0. Default: desired × 95% |
| `amount1Min` | string | No | Min token1. Default: desired × 95% |
| `recipient` | string | No | NFT recipient. Default: active wallet |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_v3_mint_position",
      "arguments": {
        "network": "mainnet",
        "positionManagerAddress": "TLMqZmBPCX5gK1rVxcNp5XvYBZQJuKjGjJ",
        "token0": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "token1": "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
        "fee": 3000,
        "amount0Desired": "10000000"
      }
    }
  }'
```

### `sunswap_v3_increase_liquidity`

Add liquidity to an existing V3 position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `positionManagerAddress` | string | Yes | V3 NonfungiblePositionManager address |
| `tokenId` | string | Yes | Token ID of the V3 position NFT |
| `token0` | string | No | Token0 address (for auto-compute) |
| `token1` | string | No | Token1 address (for auto-compute) |
| `fee` | number | No | Pool fee tier. Default: `3000` |
| `amount0Desired` | string | No | Desired additional token0 |
| `amount1Desired` | string | No | Desired additional token1 |
| `amount0Min` | string | No | Min token0. Default: desired × 95% |
| `amount1Min` | string | No | Min token1. Default: desired × 95% |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

### `sunswap_v3_decrease_liquidity`

Remove liquidity from an existing V3 position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `positionManagerAddress` | string | Yes | V3 NonfungiblePositionManager address |
| `tokenId` | string | Yes | Token ID of the V3 position NFT |
| `liquidity` | string | Yes | Amount of liquidity to burn |
| `token0` | string | No | Token0 address (for auto-compute) |
| `token1` | string | No | Token1 address (for auto-compute) |
| `fee` | number | No | Pool fee tier. Default: `3000` |
| `amount0Min` | string | No | Min token0. Auto-computed with 5% slippage |
| `amount1Min` | string | No | Min token1. Auto-computed with 5% slippage |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

### `sunswap_v3_collect`

Collect accrued fees from a V3 position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `positionManagerAddress` | string | Yes | V3 NonfungiblePositionManager address |
| `tokenId` | string | Yes | Token ID of the V3 position NFT |
| `recipient` | string | No | Fee recipient. Default: active wallet |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_v3_collect",
      "arguments": {
        "network": "mainnet",
        "positionManagerAddress": "TLMqZmBPCX5gK1rVxcNp5XvYBZQJuKjGjJ",
        "tokenId": "12345"
      }
    }
  }'
```

---

## V4 Liquidity Tools

SUNSWAP V4 uses the new concentrated liquidity model with Permit2 authorization.

### `sunswap_v4_mint_position`

Mint a new V4 concentrated liquidity position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network: `mainnet` or `nile`. Default: `mainnet` |
| `token0` | string | Yes | Token0 contract address (base58) |
| `token1` | string | Yes | Token1 contract address (base58) |
| `fee` | number | No | Pool fee tier (100, 500, 3000, 10000). Default: `500` |
| `tickLower` | number | No | Lower tick. Auto: currentTick - 100×tickSpacing |
| `tickUpper` | number | No | Upper tick. Auto: currentTick + 100×tickSpacing |
| `amount0Desired` | string | No* | Desired token0 amount. *At least one required |
| `amount1Desired` | string | No* | Desired token1 amount. *At least one required |
| `slippage` | number | No | Slippage tolerance (0.05 = 5%). Default: `0.05` |
| `recipient` | string | No | NFT recipient. Default: active wallet |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |
| `sqrtPriceX96` | string | No | Initial price for pool creation |
| `createPoolIfNeeded` | boolean | No | Auto-create pool if not exists |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_v4_mint_position",
      "arguments": {
        "network": "nile",
        "token0": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
        "token1": "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK",
        "fee": 500,
        "amount0Desired": "1000000000000000000",
        "slippage": 0.05
      }
    }
  }'
```

### `sunswap_v4_increase_liquidity`

Increase liquidity of an existing V4 position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `tokenId` | string | Yes | Token ID of the V4 position NFT |
| `token0` | string | Yes | Token0 address (required for Permit2) |
| `token1` | string | Yes | Token1 address (required for Permit2) |
| `fee` | number | No | Pool fee tier. Default: `500` |
| `amount0Desired` | string | No | Desired additional token0 |
| `amount1Desired` | string | No | Desired additional token1 |
| `slippage` | number | No | Slippage tolerance. Default: `0.05` |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

### `sunswap_v4_decrease_liquidity`

Decrease liquidity of an existing V4 position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `tokenId` | string | Yes | Token ID of the V4 position NFT |
| `liquidity` | string | Yes | Amount of liquidity to burn |
| `token0` | string | Yes | Token0 address |
| `token1` | string | Yes | Token1 address |
| `fee` | number | No | Pool fee tier. Default: `500` |
| `amount0Min` | string | No | Min token0. Default: slippage-adjusted |
| `amount1Min` | string | No | Min token1. Default: slippage-adjusted |
| `slippage` | number | No | Slippage tolerance. Default: `0.05` |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

### `sunswap_v4_collect`

Collect accrued fees from a V4 position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `tokenId` | string | Yes | Token ID of the V4 position NFT |
| `token0` | string | No | Token0 address (optional, can read from position) |
| `token1` | string | No | Token1 address (optional, can read from position) |
| `fee` | number | No | Pool fee tier (optional) |
| `deadline` | string/number | No | Unix timestamp. Default: now + 30 min |

---

## Generic Contract Tools

### `sunswap_read_contract`

Read data from a TRON smart contract (view/pure functions).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `address` | string | Yes | Contract address (base58 or hex) |
| `functionName` | string | Yes | Name of the view/pure function |
| `args` | array | No | Arguments to pass to the function |
| `abi` | array | No | Optional contract ABI |

**curl Example:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sunswap_read_contract",
      "arguments": {
        "network": "mainnet",
        "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "functionName": "balanceOf",
        "args": ["TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"]
      }
    }
  }'
```

### `sunswap_send_contract`

Execute a state-changing contract transaction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | TRON network. Default: `mainnet` |
| `address` | string | Yes | Contract address |
| `functionName` | string | Yes | Name of the function to call |
| `args` | array | No | Arguments to pass to the function |
| `value` | string | No | TRX amount in Sun to attach |
| `abi` | array | No | Optional contract ABI |

---

## Auto-Compute Features Summary

### V3 Auto-Compute

| Parameter | Mint | Increase | Decrease |
|-----------|------|----------|----------|
| `fee` | Default: 3000 | Default: 3000 | Default: 3000 |
| `tickLower/tickUpper` | Auto: ±50×tickSpacing | N/A (from position) | N/A |
| Single-sided input | ✅ Computes other amount | ✅ Computes other amount | N/A |
| `amountMin` | Auto: desired × 95% | Auto: desired × 95% | Auto: computed × 95% |
| `recipient` | Default: wallet | N/A | N/A |
| `deadline` | Default: now + 30 min | Same | Same |

### V4 Auto-Compute

| Parameter | Mint | Increase | Decrease |
|-----------|------|----------|----------|
| `fee` | Default: 500 | Default: 500 | Default: 500 |
| `tickLower/tickUpper` | Auto: ±100×tickSpacing | N/A (from position) | N/A |
| Single-sided input | ✅ Computes other amount | ✅ Computes other amount | N/A |
| `slippage` | Default: 5% | Default: 5% | Default: 5% |
| `recipient` | Default: wallet | N/A | N/A |
| `deadline` | Default: now + 30 min | Same | Same |

### SUNSWAP contract addresses and ABIs

For convenience, the project ships with default SUNSWAP contract addresses and minimal ABIs in `src/sunswap/constants.ts`:

- **V2 (mainnet)**:
  - Factory: `SUNSWAP_V2_MAINNET_FACTORY`
  - Router: `SUNSWAP_V2_MAINNET_ROUTER`
- **V2 (Nile testnet)**:
  - Factory: `SUNSWAP_V2_NILE_FACTORY`
  - Router: `SUNSWAP_V2_NILE_ROUTER`
- **V3 (mainnet)**:
  - Factory: `SUNSWAP_V3_MAINNET_FACTORY`
  - Position manager (NonfungiblePositionManager): `SUNSWAP_V3_MAINNET_POSITION_MANAGER`
- **V3 (Nile testnet)**:
  - Factory: `SUNSWAP_V3_NILE_FACTORY`
  - Position manager: `SUNSWAP_V3_NILE_POSITION_MANAGER`

The following minimal ABIs are also exposed:

- `TRC20_MIN_ABI`: `allowance`, `balanceOf`, `approve` – used by `ensureTokenAllowance` for automatic approval flows.
- `SUNSWAP_V2_FACTORY_MIN_ABI`: `getPair(tokenA, tokenB)` – used when V2 flows need to resolve pair addresses.

Tool callers can either rely on these defaults (by passing just network + token addresses), or override router/position-manager addresses and ABIs explicitly via tool parameters when interacting with non-standard deployments.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm

## Installation

```bash
git clone <your-repo-url>
cd sun-mcp-server
npm install
npm run build
```

## Configuration

Default sample configuration is already included in `config.json` and points to:

- Spec: `./specs/sunio-open-api.json`
- Target URL: `https://open.sun.io`

You can still override with CLI/env options when needed.

Key environment variables:

- `OPENAPI_SPEC_PATH`
- `TARGET_API_BASE_URL`
- `MCP_TRANSPORT` (`stdio` or `streamable-http`)
- `MCP_SERVER_HOST`, `MCP_SERVER_PORT`, `MCP_SERVER_PATH`
- `MCP_WHITELIST_OPERATIONS`, `MCP_BLACKLIST_OPERATIONS`
- `CUSTOM_HEADERS`, `HEADER_*`
- `TARGET_API_TIMEOUT_MS`

### Wallet configuration for write operations

The SUNSWAP tools support both **read-only** and **state-changing** (write) interactions.
Write operations require a wallet. The server supports two wallet modes, resolved at startup by `initWallet()` in `src/wallet/index.ts`:

| Priority | Mode | Required env |
|----------|------|-------------|
| 1 | **Agent Wallet** (encrypted, key never exposed) | `AGENT_WALLET_PASSWORD` |
| 2 | **Local Wallet** (raw private key / mnemonic) | `TRON_PRIVATE_KEY` or `TRON_MNEMONIC` |

If neither is configured, the server runs in **read-only mode** — write tools will throw an error.

#### Agent Wallet mode

Uses the [`@bankofai/agent-wallet`](https://github.com/bankofai/agent-wallet) SDK to manage encrypted wallets. Private keys are never exposed to the server process.

- `AGENT_WALLET_PASSWORD` (**required**): Decryption password for the agent-wallet keystore.
- `AGENT_WALLET_DIR`: Path to the agent-wallet secrets directory (default: `~/.agent-wallet`). Supports `~/` expansion.

You must create a wallet first using the agent-wallet CLI:

```bash
npx agent-wallet generate --name my-wallet
```

At runtime, use `sunswap_list_wallets` and `sunswap_select_wallet` to inspect and switch between wallets.

#### Local Wallet mode

- `TRON_PRIVATE_KEY`: Hex private key (with or without `0x` prefix).
- `TRON_MNEMONIC`: BIP-39 mnemonic phrase (12 or 24 words).
- `TRON_ACCOUNT_INDEX`: Optional HD derivation index (default: `0`).

#### Shared options

- `TRONGRID_API_KEY` / `TRON_GRID_API_KEY`: Optional TronGrid API key for higher rate limits.
- `TRON_RPC_URL`: Optional override for the TRON RPC endpoint; replaces the default `fullNode`, `solidityNode`, and `eventServer` URLs.

**Security note**: keep private keys, mnemonics, and wallet passwords in environment variables or a secure secrets manager. Do not commit them to source control.

## Usage

```bash
# Development mode
npm run dev

# Build
npm run build

# Start server
npm start
```

To run in HTTP MCP mode:

```bash
npm start -- --transport streamable-http --host 127.0.0.1 --port 8080 --mcpPath /mcp
```

## Client Integration

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sun-mcp-server": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/sun-mcp-server/dist/src/server.js"],
      "env": {
        "OPENAPI_SPEC_PATH": "/ABSOLUTE/PATH/TO/sun-mcp-server/specs/sunio-open-api.json",
        "TARGET_API_BASE_URL": "https://open.sun.io"
      },
      "enabled": true
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "servers": [
    {
      "name": "sun-mcp-server",
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/sun-mcp-server/dist/src/server.js"],
      "env": {
        "OPENAPI_SPEC_PATH": "/ABSOLUTE/PATH/TO/sun-mcp-server/specs/sunio-open-api.json",
        "TARGET_API_BASE_URL": "https://open.sun.io"
      }
    }
  ]
}
```

## Security Considerations

- Keep API credentials and sensitive headers in environment variables, not in shared JSON config files.
- Review and restrict custom headers before production use.
- Test operation filters (`whitelist`/`blacklist`) before exposing the server to production workflows.

## License

MIT