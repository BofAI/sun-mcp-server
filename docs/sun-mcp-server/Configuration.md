# Configuration

## Server Configuration

Default sample configuration in `config.json`:

- Spec: `./specs/sunio-open-api.json`
- Target URL: `https://open.sun.io`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAPI_SPEC_PATH` | Path to the OpenAPI spec file | `./specs/sunio-open-api.json` |
| `TARGET_API_BASE_URL` | Base URL for the SUN.IO API | `https://open.sun.io` |
| `MCP_TRANSPORT` | Transport: `stdio` or `streamable-http` | `stdio` |
| `MCP_SERVER_HOST` | HTTP server host | `127.0.0.1` |
| `MCP_SERVER_PORT` | HTTP server port | `8080` |
| `MCP_SERVER_PATH` | HTTP MCP endpoint path | `/mcp` |
| `MCP_WHITELIST_OPERATIONS` | Comma-separated list of allowed operations | (all) |
| `MCP_BLACKLIST_OPERATIONS` | Comma-separated list of blocked operations | (none) |
| `CUSTOM_HEADERS` | Custom headers as JSON | |
| `TARGET_API_TIMEOUT_MS` | API request timeout in ms | |

## TRON Wallet Configuration

Write operations (swaps, liquidity management) require a TRON wallet.

Wallet configuration is managed through [`agent-wallet`](https://github.com/BofAI/agent-wallet?tab=readme-ov-file#quick-start). Install and configure `agent-wallet` first, then provide wallet settings using the SDK-supported `AGENT_WALLET_*` options documented there.

This project no longer documents wallet field-by-field configuration in its own docs. Use the `agent-wallet` documentation as the source of truth for wallet file formats, local setup, supported flags, and environment variables.

If no wallet is configured, the server runs in read-only mode.

The runtime settings below are still supported by this server:

| Variable | Description |
|----------|-------------|
| `TRON_GRID_API_KEY` | Optional TronGrid API key |
| `TRON_RPC_URL` | Override for TRON RPC endpoint |
| `TRON_NETWORK` | Optional default network for SunKit (`mainnet` by default) |

## SUNSWAP Contract Addresses

The server ships with default contract addresses in `src/sunswap/constants.ts`:

### V2

| Network | Contract | Address |
|---------|----------|---------|
| Mainnet | Factory | `TKWJdrQkqHisa1X8HUdHEfREvTzw4pMAaY` |
| Mainnet | Router | `TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax` |
| Nile | Factory | `THomLGMLhAjMecQf9FQjbZ8a1RtwsZLrGE` |
| Nile | Router | `TMn1qrmYUMSTXo9babrJLzepKZoPC7M6Sy` |

### V3

| Network | Contract | Address |
|---------|----------|---------|
| Mainnet | Factory | `TThJt8zaJzJMhCEScH7zWKnp5buVZqys9x` |
| Mainnet | Position Manager | `TLSWrv7eC1AZCXkRjpqMZUmvgd99cj7pPF` |
| Nile | Factory | `TLJWAScHZ4Qmk1axyKMzrnoYuu2pSLer1F` |
| Nile | Position Manager | `TPQzqHbCzQfoVdAV6bLwGDos8Lk2UjXz2R` |

### Native TRX / WTRX

| Network | Address |
|---------|---------|
| TRX (all networks) | `T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb` |
| WTRX (Mainnet) | `TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR` |
| WTRX (Nile) | `TYsbWxNnyTgsZaTFaue9hqpxkU3Fkco94a` |
