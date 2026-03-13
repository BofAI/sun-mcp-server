# API 参考

## OpenAPI 自动生成的工具

基于 `specs/sunio-open-api.json` 自动生成：

### 交易 (Transactions)
- `scanTransactions` — 按协议、代币/池子、类型和时间范围扫描 DEX 交易

### 代币 (Tokens)
- `getTokens` — 按地址和协议获取代币信息
- `searchTokens` — 关键词模糊搜索代币

### 协议 (Protocols)
- `getProtocol` — 协议快照数据
- `getVolHistory` — 协议交易量历史
- `getUsersCountHistory` — 协议用户数历史
- `getTransactionsHistory` — 协议交易数历史
- `getPoolsCountHistory` — 协议池子数历史
- `getLiqHistory` — 协议流动性历史

### 价格 (Prices)
- `getPrice` — 代币价格查询

### 仓位 (Positions)
- `getUserPositions` — 用户流动性仓位
- `getPoolUserPositionTick` — 池子 tick 级别仓位详情

### 池子 (Pools)
- `getPools` — 按地址、代币或协议获取池子
- `getTopApyPoolList` — 高 APY 池子分页列表
- `searchPools` — 池子搜索
- `searchCountPools` — 池子搜索计数
- `getPoolHooks` — 池子 hooks 列表
- `getPoolVolHistory` — 池子交易量历史
- `getPoolLiqHistory` — 池子流动性历史

### 交易对 (Pairs)
- `getPairsFromEntity` — 代币对实体查询

### 挖矿 (Farms)
- `getFarms` — 挖矿池列表
- `getFarmTransactions` — 挖矿交易扫描
- `getFarmPositions` — 用户挖矿仓位

---

## SUNSWAP 工具

> 如需在本地对这些工具做端到端测试，可以使用仓库内提供的脚本：
> - `npm run script:test-sunswap-tools` 测试钱包、余额、价格、合约读写以及基于路由的流程
> - V2/V3/V4 流动性脚本位于 `scripts/test-*.ts`（完整列表见项目 README）

### sunswap_get_wallet_address

获取当前 TRON 钱包地址。

**参数:**
- `network`（可选）: `mainnet` | `nile` | `shasta`（默认: `mainnet`）

---

### sunswap_get_balances

查询 TRX 和 TRC20 余额。

**参数:**
- `network`（可选）
- `ownerAddress`（可选）: 默认使用当前钱包
- `tokens`: 数组 `{ type: "TRX" | "TRC20", tokenAddress?: string }`

---

### sunswap_get_token_price

从 SUN.IO API 获取代币价格。

**参数:**
- `tokenAddress`（可选）: 逗号分隔的地址
- `symbol`（可选）: 逗号分隔的符号

---

### sunswap_swap

高层级 Universal Router 代币兑换。

**参数:**
- `tokenIn`: 输入代币地址
- `tokenOut`: 输出代币地址
- `amountIn`: 原始数量
- `network`（可选）
- `slippage`（可选）: 小数，默认 0.005

---

### sunswap_v2_add_liquidity

添加 V2 流动性。自动检测 TRX 并使用 `addLiquidityETH`。根据池子储备计算最优数量。

**参数:**
- `network`（可选）
- `routerAddress`: V2 路由合约地址
- `tokenA`, `tokenB`: 代币地址
- `amountADesired`, `amountBDesired`: 原始数量
- `amountAMin`, `amountBMin`（可选）: 自动 5% 滑点
- `to`（可选）: 默认钱包地址
- `deadline`（可选）: 默认当前时间 + 30 分钟

---

### sunswap_v2_remove_liquidity

移除 V2 流动性。自动发现 LP 代币对。支持 TRX（`removeLiquidityETH`）。

**参数:**
- `network`（可选）
- `routerAddress`: V2 路由合约地址
- `tokenA`, `tokenB`: 底层代币地址
- `liquidity`: 要销毁的 LP 数量
- `amountAMin`, `amountBMin`（可选）: 从储备自动计算，带 5% 滑点
- `to`（可选）: 默认钱包地址
- `deadline`（可选）: 默认当前时间 + 30 分钟

---

### sunswap_v3_mint_position

创建新的 V3 集中流动性仓位，支持完整的参数自动计算。

**参数:**
- `network`（可选）
- `positionManagerAddress`: V3 仓位管理合约
- `token0`, `token1`: 代币地址
- `fee`（可选）: 池子费率，默认 3000
- `tickLower`（可选）: 自动为 currentTick − 50×tickSpacing
- `tickUpper`（可选）: 自动为 currentTick + 50×tickSpacing
- `amount0Desired`（可选）: 仅提供此项时，自动计算 amount1
- `amount1Desired`（可选）: 仅提供此项时，自动计算 amount0
- `amount0Min`, `amount1Min`（可选）: 自动 5% 滑点
- `recipient`（可选）: 默认钱包地址
- `deadline`（可选）: 默认当前时间 + 30 分钟

**返回值:**
```json
{
  "txResult": { ... },
  "computedAmounts": { "amount0Desired": "...", "amount1Desired": "..." },
  "computedTicks": { "tickLower": -3000, "tickUpper": 3000 }
}
```

**最简示例** — 仅提供 token0 数量，其余全部自动：
```json
{
  "positionManagerAddress": "TPQzqHbCzQfoVdAV6bLwGDos8Lk2UjXz2R",
  "token0": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
  "token1": "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK",
  "amount0Desired": "1000000",
  "network": "nile"
}
```

---

### sunswap_v3_increase_liquidity

向现有 V3 仓位追加代币。支持单边输入自动计算。

**参数:**
- `network`（可选）
- `positionManagerAddress`
- `tokenId`: 仓位 NFT ID
- `token0`, `token1`（可选）: 单边自动计算和授权所需
- `fee`（可选）: 默认 3000
- `amount0Desired`（可选）
- `amount1Desired`（可选）
- `amount0Min`, `amount1Min`（可选）: 自动 5% 滑点
- `deadline`（可选）: 默认当前时间 + 30 分钟

---

### sunswap_v3_decrease_liquidity

从 V3 仓位移除流动性。基于 V3 数学自动计算 amountMin。

**参数:**
- `network`（可选）
- `positionManagerAddress`
- `tokenId`: 仓位 NFT ID
- `liquidity`: 要销毁的流动性数量
- `token0`, `token1`（可选）: 提供后启用自动 amountMin
- `fee`（可选）: 默认 3000
- `amount0Min`, `amount1Min`（可选）: 从 `getAmountsForLiquidity` × 95% 自动计算
- `deadline`（可选）: 默认当前时间 + 30 分钟

---

### sunswap_v3_collect

领取 V3 仓位累计的交易手续费。执行前先预估可领取金额。

**参数:**
- `network`（可选）
- `positionManagerAddress`
- `tokenId`: 仓位 NFT ID
- `recipient`（可选）: 默认钱包地址

**返回值:**
```json
{
  "estimatedFees": { "amount0": "12345", "amount1": "67890" },
  "txResult": { ... }
}
```

---

### sunswap_read_contract

读取合约 view/pure 函数。

**参数:**
- `network`（可选）
- `address`: 合约地址
- `functionName`: 函数名
- `args`（可选）
- `abi`（可选）

---

### sunswap_send_contract

发送状态变更合约交易。

**参数:**
- `network`（可选）
- `address`: 合约地址
- `functionName`: 函数名
- `args`（可选）
- `value`（可选）: TRX（单位 Sun）
- `abi`（可选）
