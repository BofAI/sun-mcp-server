# 配置说明

## 服务器配置

默认示例配置在 `config.json` 中：

- Spec: `./specs/sunio-open-api.json`
- 目标 URL: `https://open.sun.io`

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAPI_SPEC_PATH` | OpenAPI 规范文件路径 | `./specs/sunio-open-api.json` |
| `TARGET_API_BASE_URL` | SUN.IO API 基础地址 | `https://open.sun.io` |
| `MCP_TRANSPORT` | 传输方式: `stdio` 或 `streamable-http` | `stdio` |
| `MCP_SERVER_HOST` | HTTP 服务器地址 | `127.0.0.1` |
| `MCP_SERVER_PORT` | HTTP 服务器端口 | `8080` |
| `MCP_SERVER_PATH` | HTTP MCP 端点路径 | `/mcp` |
| `MCP_WHITELIST_OPERATIONS` | 允许的操作（逗号分隔） | （全部） |
| `MCP_BLACKLIST_OPERATIONS` | 屏蔽的操作（逗号分隔） | （无） |
| `CUSTOM_HEADERS` | 自定义请求头（JSON 格式） | |
| `TARGET_API_TIMEOUT_MS` | API 请求超时（毫秒） | |

## TRON 钱包配置

写操作（兑换、流动性管理）需要 TRON 钱包。

钱包配置统一通过 [`agent-wallet`](https://github.com/BofAI/agent-wallet?tab=readme-ov-file#quick-start) 管理。请先安装并配置 `agent-wallet`，再按其文档使用 SDK 支持的 `AGENT_WALLET_*` 配置项。

本项目不再在自身文档中逐项说明钱包配置细节。钱包文件格式、本地初始化方式、支持的命令行参数与环境变量，请直接以 `agent-wallet` 文档为准。

如果未配置钱包，服务会以只读模式运行。

本服务仍支持以下运行时配置：

| 变量 | 说明 |
|------|------|
| `TRON_GRID_API_KEY` | 可选 TronGrid API 密钥 |
| `TRON_RPC_URL` | 覆盖 TRON RPC 节点地址 |
| `TRON_NETWORK` | SunKit 默认网络（默认: `mainnet`） |

## SUNSWAP 合约地址

服务器内置了默认合约地址，位于 `src/sunswap/constants.ts`：

### V2

| 网络 | 合约 | 地址 |
|------|------|------|
| 主网 | Factory | `TKWJdrQkqHisa1X8HUdHEfREvTzw4pMAaY` |
| 主网 | Router | `TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax` |
| Nile | Factory | `THomLGMLhAjMecQf9FQjbZ8a1RtwsZLrGE` |
| Nile | Router | `TMn1qrmYUMSTXo9babrJLzepKZoPC7M6Sy` |

### V3

| 网络 | 合约 | 地址 |
|------|------|------|
| 主网 | Factory | `TThJt8zaJzJMhCEScH7zWKnp5buVZqys9x` |
| 主网 | Position Manager | `TLSWrv7eC1AZCXkRjpqMZUmvgd99cj7pPF` |
| Nile | Factory | `TLJWAScHZ4Qmk1axyKMzrnoYuu2pSLer1F` |
| Nile | Position Manager | `TPQzqHbCzQfoVdAV6bLwGDos8Lk2UjXz2R` |

### 原生 TRX / WTRX

| 网络 | 地址 |
|------|------|
| TRX（所有网络） | `T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb` |
| WTRX（主网） | `TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR` |
| WTRX（Nile） | `TYsbWxNnyTgsZaTFaue9hqpxkU3Fkco94a` |
