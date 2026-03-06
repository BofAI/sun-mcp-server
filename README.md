# SUN MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Network](https://img.shields.io/badge/Network-TRON-red)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)

An MCP server focused on the SUN.IO (SUNSWAP) ecosystem. This project currently exposes the SUN.IO API surface defined in `specs/sunio-open-api.json`, allowing AI clients to comprehensively query TRON DEX ecosystem data (including tokens, pools, prices, protocol metrics, transactions, farming, contracts, and chain status). In the future, the server will expand beyond read-only access to support core DeFi execution capabilities, such as liquidity management and token swapping operations.

## Contents

- [Overview](#overview)
- [Supported SUN.IO API Domains](#supported-sunio-api-domains)
- [API Reference (from `sunio-open-api.json`)](#api-reference-from-sunio-open-apijson)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Client Integration](#client-integration)
- [Security Considerations](#security-considerations)
- [Project Structure](#project-structure)
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

### SUN.IO / SUNSWAP tools

In addition to the OpenAPI-generated tools, this server registers a set of custom SUNSWAP tools under the `sunswap_*` prefix via `src/tools/sunswap.ts`. These include:

- Wallet and balances:
  - `sunswap_get_wallet_address`
  - `sunswap_get_balances`
- Pricing and quoting:
  - `sunswap_get_token_price`
  - `sunswap_quote_exact_input`
- Generic contract helpers:
  - `sunswap_read_contract` (view/pure calls)
  - `sunswap_send_contract` (state-changing calls)
- Swap and liquidity management:
  - `sunswap_swap_exact_input` (low-level router swap, takes router address/ABI and arguments)
  - `sunswap_swap` (high-level simple swap via Universal Router; only needs `tokenIn`, `tokenOut`, `amountIn`, optional `network`/`slippage`)
  - `sunswap_v2_add_liquidity` (V2-style add liquidity; auto-checks/sets TRC20 approvals for both input tokens before calling router)
  - `sunswap_v2_remove_liquidity` (V2-style remove liquidity; auto-checks/sets LP token approval before calling router)
  - `sunswap_v3_mint_position` (V3 mint; auto-checks/sets TRC20 approvals for both input tokens before calling position manager)
  - `sunswap_v3_increase_liquidity` (V3 increase liquidity; uses the same approval helper for additional deposits)
  - `sunswap_v3_decrease_liquidity`

These tools follow the same MCP tooling pattern as the OpenAPI-mapped tools and can be invoked from MCP-compatible clients once the server is running. All write tools reuse the same wallet abstraction and contract helper pipeline (`readContract` / `sendContractTx` / `ensureTokenAllowance`).

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

### TRON wallet configuration for write operations

The SUNSWAP tools support both **read-only** and **state-changing** (write) interactions.  
Write operations require a TRON wallet to be available to the server, either via local environment variables or an Agent Wallet provider injected by the host.

Local wallet configuration (used by `src/sunswap/wallet.ts`):

- `TRON_PRIVATE_KEY`: Hex private key (with or without `0x` prefix).
- `TRON_MNEMONIC`: BIP-39 mnemonic phrase (12 or 24 words).
- `TRON_ACCOUNT_INDEX`: Optional account index for HD wallet derivation (default: `0`).
- `TRONGRID_API_KEY` / `TRON_GRID_API_KEY`: Optional TronGrid API key used when constructing `TronWeb` instances.
- `TRON_RPC_URL`: Optional override for the TRON RPC endpoint; when set, it replaces the default `fullNode`, `solidityNode`, and `eventServer` URLs from the built-in network table.

If neither `TRON_PRIVATE_KEY` nor `TRON_MNEMONIC` is set and no Agent Wallet provider is supplied, write tools will throw an error indicating that no wallet is available.

**Security note**: keep TRON private keys and mnemonics in environment variables or a secure secrets manager. Do not commit them to source control.

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


curl -X POST "http://127.0.0.1:8080/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "sunswap_v2_add_liquidity",
      "arguments": {
        "network": "nile",
        "routerAddress": "TMn1qrmYUMSTXo9babrJLzepKZoPC7M6Sy",
        "tokenA": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
        "tokenB": "TWMCMCoJPqCGw5RR7eChF2HoY3a9B8eYA3",
        "amountADesired": "1000000",
        "amountBDesired": "1500000"
      }
    }
  }'