# SUN MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Network](https://img.shields.io/badge/Network-TRON-red)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)

An MCP server for AI-driven DeFi operations on the TRON network through the SUN.IO / SUNSWAP ecosystem.

## Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
  - [Official Hosted MCP (Read-Only)](#official-hosted-mcp-read-only)
  - [Local Hosted MCP](#local-hosted-mcp)
    - [Wallet Configuration (Optional)](#wallet-configuration-optional)
  - [Example Prompts](#example-prompts)
- [Client Integration Guide](#client-integration-guide)
  - [Claude Desktop](#claude-desktop)
  - [Cursor](#cursor)
  - [Production HTTP Deployment](#production-http-deployment)
- [API & Tools Reference](#api--tools-reference)
  - [Supported SUN.IO API Domains](#supported-sunio-api-domains)
  - [Wallet & Portfolio](#wallet--portfolio)
  - [Price & Quote](#price--quote)
  - [Swap](#swap)
  - [V2 Liquidity](#v2-liquidity)
  - [V3 Liquidity](#v3-liquidity)
  - [V4 Liquidity](#v4-liquidity)
  - [Generic Contract](#generic-contract)
  - [Auto-Compute Features](#auto-compute-features)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Overview

Connect any AI client to the TRON DeFi ecosystem through a single MCP endpoint. With `@bankofai/sun-mcp-server`, your AI agent can:

- **Query** — token prices, pool stats, liquidity positions, farming rewards, protocol metrics
- **Quote** — swap routes and price impact across SUNSwap V2, V3, and V4
- **Execute** — token swaps, liquidity add/remove, position management (wallet required)
- **Contract** — read from or write to arbitrary TRON smart contracts

The server supports **stdio** (local) and **Streamable HTTP** (remote) transports. Without a wallet configured, it runs in read-only mode — safe for exploration and data queries.

## Quick Start

### Official Hosted MCP (Read-Only)

The fastest way to try SUN MCP Server — no installation, no configuration. BankOfAI hosts a public read-only instance.

**Point your client to the official endpoint:**

```bash
claude mcp add --transport http sun-mcp-server https://sun-mcp-server.bankofai.io/mcp
```

This gives you access to all read-only tools: token prices, pool data, positions, quoting, and more. No wallet is configured on the hosted instance, so write operations (swaps, liquidity) are not available.

**curl example** — call the `getPrice` tool via MCP JSON-RPC:

```bash
curl -X POST https://sun-mcp-server.bankofai.io/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "getPrice",
      "arguments": {
        "tokenAddress": "TKkeiboTkxXKJpbmVFbv4a8ov5rAfRDMf9"
      }
    }
  }'
```

Response (SSE format):

```
event: message
data: {
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"msg\":\"SUCCESS\",\"code\":0,\"data\":{\"TKkeiboTkxXKJpbmVFbv4a8ov5rAfRDMf9\":{\"quote\":{\"USD\":{\"price\":\"37.513242926312\"}}}},\"status\":{\"error_code\":0}}"
      }
    ]
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

> No local installation needed. Works with any MCP client that supports Streamable HTTP.

### Local Hosted MCP

Run the server locally with full capabilities — including write operations if you configure a wallet.

**Install:**

```bash
npm install -g @bankofai/sun-mcp-server
```

#### Wallet Configuration

Without a wallet, the server works in **read-only mode** — you can query prices, pools, positions, and more.

To enable write operations (swaps, liquidity, contract calls), set exactly **one** wallet source:

**Option 1 (Recommended): [Agent Wallet](https://github.com/BofAI/agent-wallet#cli)** — password-protected encrypted keystore, purpose-built for AI agents. Private keys are never stored in plaintext.

```bash
export AGENT_WALLET_PASSWORD=your_wallet_password
export AGENT_WALLET_DIR=/absolute/path/to/.agent   # optional, defaults to ~/.agent
```

**Option 2: Private Key** — pass a hex private key directly.

```bash
export TRON_PRIVATE_KEY=your_private_key
```

**Option 3: Mnemonic** — derive a wallet from a BIP-39 seed phrase.

```bash
export TRON_MNEMONIC="word1 word2 word3 ..."
export TRON_MNEMONIC_ACCOUNT_INDEX=0   # optional, default 0
```

> **Security warning:** Option 2 and 3 store keys in plaintext (environment variables / `.env` files), which carries a risk of key leakage. Use them only with small amounts of funds for testing. For production or larger balances, use Agent Wallet (Option 1).

Optional runtime settings:

```bash
export TRON_NETWORK=mainnet              # mainnet (default), nile, or shasta
export TRON_GRID_API_KEY=your_api_key    # recommended for production
export TRON_RPC_URL=https://your-rpc     # custom RPC endpoint
```

The server auto-loads `.env` files via `dotenv`, so you can put these in a `.env` file instead of exporting them.

**stdio** — the MCP client spawns and manages the server process automatically. No manual server management needed.

```bash
# Read-only (no wallet)
claude mcp add sun-mcp-server sun-mcp-server

# With wallet and runtime settings
claude mcp add sun-mcp-server sun-mcp-server \
  -e TRON_PRIVATE_KEY=your_private_key
```

Environment variables passed via `-e` are injected into the server process. Claude starts the server when it needs SUN.IO tools, and stops it when done.

> You can also skip the global install and use `npx`:
> ```bash
> claude mcp add sun-mcp-server -- npx -y @bankofai/sun-mcp-server
> ```

**Streamable HTTP** — run a persistent HTTP server, useful for sharing one endpoint across a team or deploying in Docker / Kubernetes.

```bash
# Start the server
sun-mcp-server --transport streamable-http --host 127.0.0.1 --port 8080 --mcpPath /mcp

# Register it with your MCP client
claude mcp add --transport http sun-mcp-server http://127.0.0.1:8080/mcp
```

> For external access (e.g. from other machines or containers), bind to `0.0.0.0` instead of `127.0.0.1`.

### Verify

Confirm the server is registered:

```bash
claude mcp list
```

You should see `sun-mcp-server` in the output. Now just chat with Claude — see [Example Prompts](#example-prompts) below.

### Example Prompts

**Market data (read-only, no wallet needed):**

- "Get the current price of SUN and JST on TRON."
- "List the most liquid SUNSwap pools for USDT."
- "Show my V3 and V4 positions for wallet `T...`."

**Quoting (read-only):**

- "Quote a swap from 100 USDT to TRX on SUNSwap."
- "Quote the best exact-input route for 500 USDT to SUN."

**Wallet & execution (requires wallet):**

- "Get balances for my active wallet on TRON."
- "Swap 100 USDT to TRX on SUNSwap."
- "Mint a V3 position between these two ticks."
- "Increase liquidity for this V4 position."

**Contract interaction:**

- "Read the `slot0` state from this SUNSwap pool contract."

## Client Integration Guide

The [Quick Start](#quick-start) examples use Claude Code. If you use a different MCP client, follow the patterns below.

### Claude Desktop

Add to your MCP configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

**stdio (recommended):**

```json
{
  "mcpServers": {
    "sun-mcp-server": {
      "command": "sun-mcp-server",
      "args": [],
      "env": {
        "TRON_NETWORK": "mainnet"
      }
    }
  }
}
```

**Remote HTTP** (if using a hosted or self-hosted HTTP endpoint):

```json
{
  "mcpServers": {
    "sun-mcp-server": {
      "url": "http://127.0.0.1:8080/mcp"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

**stdio:**

```json
{
  "mcpServers": {
    "sun-mcp-server": {
      "command": "sun-mcp-server",
      "args": [],
      "env": {
        "TRON_NETWORK": "mainnet"
      }
    }
  }
}
```

**Remote HTTP:**

```json
{
  "mcpServers": {
    "sun-mcp-server": {
      "url": "http://127.0.0.1:8080/mcp"
    }
  }
}
```

### Production HTTP Deployment

If you are deploying the server for shared or production use, consider adding:

- TLS termination via reverse proxy (Nginx, Caddy, Cloudflare)
- Authentication at the proxy or gateway layer
- Request logging and rate limiting
- Secret injection through your deployment platform instead of `.env` files

## API & Tools Reference

| Category | Tools | Wallet Required | Description |
|----------|-------|:---:|-------------|
| [SUN.IO API](#supported-sunio-api-domains) | Dynamic (from OpenAPI spec) | No | Protocol, token, pool, pair, price, position, farm data |
| [Wallet & Portfolio](#wallet--portfolio) | `get_wallet_address`, `get_balances` | Yes | Wallet address and TRX/TRC20 balances |
| [Price & Quote](#price--quote) | `get_token_price`, `quote_exact_input` | No | Spot prices and smart-router quoting |
| [Swap](#swap) | `swap`, `swap_exact_input` | Quote: No / Execute: Yes | Route discovery and token swaps |
| [V2 Liquidity](#v2-liquidity) | `v2_add_liquidity`, `v2_remove_liquidity` | Yes | Classic LP add/remove |
| [V3 Liquidity](#v3-liquidity) | `v3_mint_position`, `v3_increase_liquidity`, `v3_decrease_liquidity`, `v3_collect` | Yes | Concentrated liquidity positions |
| [V4 Liquidity](#v4-liquidity) | `v4_mint_position`, `v4_increase_liquidity`, `v4_decrease_liquidity`, `v4_collect` | Yes | V4 position management and fee collection |
| [Generic Contract](#generic-contract) | `read_contract`, `send_contract` | Read: No / Send: Yes | Direct TRON contract interaction |

> All custom tool names are prefixed with `sunswap_` (e.g. `sunswap_swap`, `sunswap_v3_mint_position`).

---

### Supported SUN.IO API Domains

The server dynamically generates read-only tools from the bundled SUN.IO OpenAPI spec. The default spec includes:

| Domain | Tool | Endpoint | Description |
|--------|------|----------|-------------|
| Transactions | `scanTransactions` | `GET /apiv2/transactions/scan` | Scan swap/add/withdraw activity with pagination |
| Tokens | `getTokens` | `GET /apiv2/tokens` | Fetch tokens by address and protocol |
| | `searchTokens` | `GET /apiv2/tokens/search` | Fuzzy token search by keyword |
| Protocols | `getProtocol` | `GET /apiv2/protocols` | Protocol snapshot data |
| | `getVolHistory` | `GET /apiv2/protocols/history/vol` | Protocol volume history |
| | `getLiqHistory` | `GET /apiv2/protocols/history/liq` | Protocol liquidity history |
| | `getUsersCountHistory` | `GET /apiv2/protocols/history/usersCount` | Protocol users history |
| | `getTransactionsHistory` | `GET /apiv2/protocols/history/transactions` | Protocol transaction count history |
| | `getPoolsCountHistory` | `GET /apiv2/protocols/history/poolsCount` | Protocol pool count history |
| Prices | `getPrice` | `GET /apiv2/price` | Token price by address |
| Positions | `getUserPositions` | `GET /apiv2/positions/user` | User liquidity positions |
| | `getPoolUserPositionTick` | `GET /apiv2/positions/tick` | Pool tick-level position details |
| Pools | `getPools` | `GET /apiv2/pools` | Fetch pools by address, token, or protocol |
| | `searchPools` | `GET /apiv2/pools/search` | Pool search |
| | `searchCountPools` | `GET /apiv2/pools/search/count` | Pool search count |
| | `getTopApyPoolList` | `GET /apiv2/pools/top_apy_list` | Top APY pools (paginated) |
| | `getPoolHooks` | `GET /apiv2/pools/hooks` | Pool hooks list |
| | `getPoolVolHistory` | `GET /apiv2/pools/history/vol` | Pool volume history |
| | `getPoolLiqHistory` | `GET /apiv2/pools/history/liq` | Pool liquidity history |
| Pairs | `getPairsFromEntity` | `GET /apiv2/pairs` | Token pair entity query |
| Farms | `getFarms` | `GET /apiv2/farms` | Farming pool list |
| | `getFarmTransactions` | `GET /apiv2/farms/transactions` | Farm transaction scanning |
| | `getFarmPositions` | `GET /apiv2/farms/positions/user` | User farming positions |

> The exact set of tools depends on the loaded OpenAPI spec and any configured whitelist/blacklist filters.

### Wallet & Portfolio

Key tools:

- `sunswap_get_wallet_address` — returns the active TRON wallet address
- `sunswap_get_balances` — returns TRX and TRC20 token balances for the active wallet

These tools are read-only and require a configured wallet source.

### Price & Quote

Key tools:

- `sunswap_get_token_price` — spot price lookup via SUN.IO API
- `sunswap_quote_exact_input` — smart-router exact-input quoting across SUNSwap V2, V3, and V4 pools

Both tools are read-only and do not require a wallet.

### Swap

Key tools:

- `sunswap_swap` — higher-level swap that handles route computation and execution in one call
- `sunswap_swap_exact_input` — execute an exact-input swap via the smart router

Swap tools can operate in:

- Read-only quote mode without a wallet
- Execution mode with a configured wallet source

### V2 Liquidity

Key tools:

- `sunswap_v2_add_liquidity`
- `sunswap_v2_remove_liquidity`

Use these for classic LP flows on SUNSwap V2-style pools.

### V3 Liquidity

Key tools:

- `sunswap_v3_mint_position`
- `sunswap_v3_increase_liquidity`
- `sunswap_v3_decrease_liquidity`
- `sunswap_v3_collect`

These tools support concentrated liquidity workflows for SUNSwap V3-style positions.

### V4 Liquidity

Key tools:

- `sunswap_v4_mint_position`
- `sunswap_v4_increase_liquidity`
- `sunswap_v4_decrease_liquidity`
- `sunswap_v4_collect`

These tools support SUNSwap V4-style position management and fee collection.

### Generic Contract

Key tools:

- `sunswap_read_contract`
- `sunswap_send_contract`

Use these when you need direct TRON contract interaction outside the higher-level abstractions.

### Auto-Compute Features

The higher-level SUNSwap tools automatically compute or fill in parameters so that clients can call them with minimal input. Below is what each category handles:

**All write tools:**

- `recipient` defaults to the active wallet address
- `deadline` defaults to 30 minutes from now
- Transactions are built, signed, and broadcast in a single call

**V3 Mint (`sunswap_v3_mint_position`):**

- If tick range is omitted, defaults to ±50 × tickSpacing around the current price
- Supports single-sided input — provide only `amount0` or `amount1`
- Slippage tolerance defaults to 95%

**V4 Mint (`sunswap_v4_mint_position`):**

- If tick range is omitted, defaults to ±100 × tickSpacing around the current price
- Slippage tolerance defaults to 5%

**Swap tools:**

- `sunswap_swap` handles route discovery, quoting, and execution as one operation
- `sunswap_swap_exact_input` accepts a pre-computed route or finds the best one automatically

This reduces client-side orchestration and keeps the MCP interface simpler than raw contract calls.

## Troubleshooting

**Write tools fail with "no wallet configured"**
You are running in read-only mode. Set exactly one wallet source (`TRON_PRIVATE_KEY`, `TRON_MNEMONIC`, or `AGENT_WALLET_PASSWORD`) and restart the server.

**Server rejects startup with "conflicting wallet modes"**
More than one wallet source is set. Remove the extras so that only one of the three wallet environment variable groups is present.

**Too many tools — LLM context or token limit exceeded**
Use `--whitelist` / `--blacklist` (or the `MCP_WHITELIST_OPERATIONS` / `MCP_BLACKLIST_OPERATIONS` environment variables) to limit which OpenAPI tools are exposed. For example, `--whitelist "getPools,getTokenPrice,GET:/apiv2/tokens/*"` keeps only the tools you need.

**API requests time out or return empty results**
Check `TRON_RPC_URL` and `TRON_GRID_API_KEY`. The default public TronGrid endpoint has rate limits. For production use, supply your own API key or a dedicated RPC endpoint.

**Connection refused on Streamable HTTP**
Verify `MCP_SERVER_HOST`, `MCP_SERVER_PORT`, and `MCP_SERVER_PATH` match what your client is connecting to. If the server binds to `127.0.0.1`, it will not be reachable from other machines — use `0.0.0.0` for external access.

## Security Considerations

- Treat `TRON_PRIVATE_KEY`, `TRON_MNEMONIC`, and `AGENT_WALLET_PASSWORD` as production secrets.
- Configure exactly one wallet source at a time. The server rejects conflicting wallet modes.
- Prefer read-only deployments when you only need market data or position inspection.
- Do not expose a write-enabled Streamable HTTP deployment directly to the public internet without authentication and transport security.
- If you use `AGENT_WALLET_PASSWORD`, keep `AGENT_WALLET_DIR` on encrypted storage where possible.
- Review any custom RPC endpoint before use. A malicious or misconfigured RPC can degrade reliability or leak metadata.
- Log carefully. Avoid writing secrets, raw signed payloads, or sensitive wallet paths to logs.
