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

必须且只能配置一种钱包来源。如果同时设置多种来源，服务启动会失败；如果完全不设置，则服务以只读模式运行。

| 变量 | 说明 |
|------|------|
| `TRON_PRIVATE_KEY` | 十六进制私钥（可带或不带 `0x` 前缀） |
| `TRON_MNEMONIC` | BIP-39 助记词（12 或 24 个单词） |
| `TRON_MNEMONIC_ACCOUNT_INDEX` | `TRON_MNEMONIC` 的 HD 钱包派生索引（默认: `0`） |
| `AGENT_WALLET_PASSWORD` | 已存在 agent-wallet keystore 的密码 |
| `AGENT_WALLET_DIR` | 可选的 agent-wallet secrets 目录路径 |
| `TRON_GRID_API_KEY` | 可选 TronGrid API 密钥 |
| `TRON_RPC_URL` | 覆盖 TRON RPC 节点地址 |
| `TRON_NETWORK` | SunKit 默认网络（默认: `mainnet`） |

服务底层统一通过 `@bankofai/agent-wallet` 解析钱包。`TRON_PRIVATE_KEY` 和 `TRON_MNEMONIC` 会先映射到 agent-wallet provider 所需环境变量，再解析 active wallet。

**安全提示**: 将私钥、助记词和钱包密码保存在环境变量或密钥管理器中，切勿提交到代码仓库。

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
