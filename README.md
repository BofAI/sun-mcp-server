# SUN MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Network](https://img.shields.io/badge/Network-TRON-red)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)

An MCP server focused on SUN.IO (SUNSWAP) data access. This project exposes the SUN.IO API surface defined in `specs/sunio-open-api.json` so AI clients can query TRON DEX ecosystem data including tokens, pools, prices, protocol metrics, transactions, farming, contracts, and chain status.

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

## Supported SUN.IO API Domains

- **Transactions**: scan swap/add/withdraw activity with pagination.
- **Tokens**: fetch token metadata, search tokens, and scan token lists.
- **SUN Token**: query SUN burn log statistics.
- **Protocols**: fetch protocol snapshots and historical KPI series.
- **Prices**: fetch token price by address.
- **Positions**: query user liquidity positions and tick-level data.
- **Pools**: list/search/scan pools, fetch top APY pools, hooks, and pool history.
- **Pairs**: query token pair information.
- **Farms**: list farms, scan farm transactions, query user farm positions.
- **Contracts**: scan contract registry entries.
- **Chain**: fetch latest block info.

## API Reference (from `sunio-open-api.json`)

### Transactions

- `scanTransactions` (`GET /apiv2/transactions/scan`): scan DEX transactions by protocol, token/pool, type, and time range.

### Tokens

- `getTokens` (`GET /apiv2/tokens`): fetch tokens by address and protocol.
- `searchTokens` (`GET /apiv2/tokens/search`): fuzzy token search by keyword.
- `scanTokens` (`GET /apiv2/tokens/scan`): incremental token scanning.

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
- `scanPools` (`GET /apiv2/pools/scan`): incremental pool scanning.
- `getPoolHooks` (`GET /apiv2/pools/hooks`): pool hooks list.
- `getVolHistory_2` (`GET /apiv2/pools/history/vol`): pool volume history.
- `getLiqHistory_1` (`GET /apiv2/pools/history/liq`): pool liquidity history.

### Pairs

- `getPairsFromEntity` (`GET /apiv2/pairs`): token pair entity query.

### Farms

- `getFarms` (`GET /apiv2/farms`): farming pool list.
- `getFarmTransactions` (`GET /apiv2/farms/transactions`): farm transaction scanning.
- `getFarmPositions` (`GET /apiv2/farms/positions/user`): user farming positions.

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
