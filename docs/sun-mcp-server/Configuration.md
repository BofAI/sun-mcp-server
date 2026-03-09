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

| Variable | Description |
|----------|-------------|
| `TRON_PRIVATE_KEY` | Hex private key (with or without `0x` prefix) |
| `TRON_MNEMONIC` | BIP-39 mnemonic phrase (12 or 24 words) |
| `TRON_ACCOUNT_INDEX` | HD wallet derivation index (default: `0`) |
| `TRONGRID_API_KEY` / `TRON_GRID_API_KEY` | Optional TronGrid API key |
| `TRON_RPC_URL` | Override for TRON RPC endpoint |

**Priority**: `TRON_PRIVATE_KEY` > `TRON_MNEMONIC` > AgentWallet provider.

**Security**: Keep private keys and mnemonics in environment variables or a secret manager. Never commit them to source control.

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
