# Introduction

SUN MCP Server is a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes the SUN.IO / SUNSWAP ecosystem to AI agents.

It serves two categories of capabilities:

1. **Read-only data** — auto-generated from the SUN.IO OpenAPI specification (`specs/sunio-open-api.json`), covering tokens, pools, prices, protocols, positions, farms, and transactions.
2. **DeFi execution** — hand-written SUNSWAP tools (`sunswap_*`) for token swaps, V2/V3/V4 liquidity management, and generic contract interaction.

The server supports both `stdio` and `streamable-http` transports and integrates with Claude Desktop, Cursor, and any MCP-compatible client.
