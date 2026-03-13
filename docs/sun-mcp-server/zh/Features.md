# 功能特性

## 只读 API 接口

基于 SUN.IO OpenAPI 规范自动生成：

- **交易 (Transactions)**: 按协议、代币/池子、类型和时间范围扫描交易
- **代币 (Tokens)**: 获取元数据、模糊搜索
- **协议 (Protocols)**: 快照、交易量/流动性/用户/交易数历史
- **价格 (Prices)**: 实时代币价格
- **仓位 (Positions)**: 用户 LP 仓位、tick 级别数据
- **池子 (Pools)**: 列表、搜索、高 APY 池子、hooks、交易量/流动性历史
- **交易对 (Pairs)**: 代币对查询
- **挖矿 (Farms)**: 挖矿池列表、交易扫描、用户挖矿仓位

## SUNSWAP 执行工具

### 钱包与余额

- `sunswap_get_wallet_address` — 获取当前 TRON 钱包地址
- `sunswap_get_balances` — 查询 TRX 和 TRC20 余额

### 价格与报价

- `sunswap_get_token_price` — 从 SUN.IO API 获取代币价格
- `sunswap_quote_exact_input` — 智能路由兑换预估

### 兑换

- `sunswap_swap` — 高层级 Universal Router 兑换（tokenIn, tokenOut, amountIn）
- `sunswap_swap_exact_input` — 底层路由兑换，完全可控

### V2 流动性

- `sunswap_v2_add_liquidity` — 添加 V2 流动性：
  - 自动 TRC20 授权管理
  - 自适应最优数量计算（`computeOptimalAmounts`）
  - 原生 TRX 支持（`addLiquidityETH`）
  - 自动滑点（5%）和截止时间（30 分钟）
- `sunswap_v2_remove_liquidity` — 移除 V2 流动性：
  - 自动从工厂合约发现 LP 代币对
  - 原生 TRX 支持（`removeLiquidityETH`）
  - 基于池子储备自动计算 `amountMin` 并带滑点

### V3 流动性

所有 V3 工具支持智能参数自动计算：

| 参数 | 铸造 (Mint) | 增加 (Increase) | 减少 (Decrease) |
|------|-------------|-----------------|-----------------|
| `fee` | 默认 3000 | 默认 3000 | 默认 3000 |
| `tickLower`/`tickUpper` | 自动：currentTick ± 50×tickSpacing | 从仓位读取 | 不适用 |
| 单边输入 | 自动通过 V3 数学计算另一边 | 同上（需 token0/token1/fee） | 不适用 |
| `amountMin` | desired × 95% | desired × 95% | 从 `getAmountsForLiquidity` × 95% |
| `recipient` | 默认：钱包地址 | 不适用 | 不适用 |
| `deadline` | 默认：当前时间 + 30 分钟 | 同上 | 同上 |

- `sunswap_v3_mint_position` — 创建新的集中流动性仓位
- `sunswap_v3_increase_liquidity` — 向现有仓位追加流动性
- `sunswap_v3_decrease_liquidity` — 从现有仓位移除流动性
- `sunswap_v3_collect` — 领取累计交易手续费（附预估）

### 通用合约工具

- `sunswap_read_contract` — 读取合约 view/pure 函数
- `sunswap_send_contract` — 发送状态变更交易

## 开发者本地测试脚本

仓库内提供了一组 `ts-node` 脚本，方便在本地对各类 SUNSWAP 工具做端到端验证：

- **V2 流动性**
  - `npm run script:test-add-liquidity`
  - `npm run script:test-remove-liquidity`
- **V3 流动性**
  - `npm run script:test-v3-mint`
  - `npm run script:test-v3-increase`
  - `npm run script:test-v3-decrease`
  - `npm run script:test-v3-collect`
- **V4 流动性**
  - `npm run script:test-v4-mint`
  - `npm run script:test-v4-increase`
  - `npm run script:test-v4-decrease`
  - `npm run script:test-v4-collect`
- **SunPump / 高层兑换**
  - `npm run script:test-sunpump-buy`
  - `npm run script:test-sunpump-sell`
  - `npm run script:test-sunpump-swap`
- **OpenAPI / SUN.IO API**
  - `npm run script:test-openapi`（加上 `-- --fetch` 可测试 `GET /apiv2/price` 实际接口）
- **SUNSWAP 工具综合脚本**
  - `npm run script:test-sunswap-tools` — 统一测试钱包地址、余额、价格、合约只读，以及（可选）路由报价/兑换和 `sunswap_send_contract`，通过环境变量开关控制。

这些脚本适用于维护者和集成方，用于在真实 TRON 网络上做回归和联调。

## V3 数学引擎

服务器内置了从 Uniswap V3 Solidity 移植的 V3 数学引擎（`src/sunswap/v3Math.ts`）：

- `getSqrtRatioAtTick` — TickMath.getSqrtRatioAtTick
- `maxLiquidityForAmounts` — 从代币数量计算最大流动性
- `getAmountsForLiquidity` — 从流动性计算代币数量
- `nearestUsableTick` — 将 tick 对齐到有效的 tickSpacing 边界

## V3 池子读取器

`src/sunswap/v3Pool.ts` 从 V3 工厂合约读取实时池子状态：

- 通过 factory.getPool 从代币对 + fee 解析池子地址
- 读取 slot0（sqrtPriceX96、currentTick）、liquidity 和 tickSpacing
