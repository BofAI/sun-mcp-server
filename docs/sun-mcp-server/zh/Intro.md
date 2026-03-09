# 简介

SUN MCP Server 是一个 [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) 服务器，为 AI 智能体暴露 SUN.IO / SUNSWAP 生态系统的完整能力。

它提供两类功能：

1. **只读数据查询** — 基于 SUN.IO OpenAPI 规范（`specs/sunio-open-api.json`）自动生成，涵盖代币、池子、价格、协议、仓位、挖矿和交易等。
2. **DeFi 执行操作** — 手写的 SUNSWAP 工具（`sunswap_*` 前缀），支持钱包查询、代币兑换、V2/V3 流动性管理和通用合约交互。

服务器同时支持 `stdio` 和 `streamable-http` 传输方式，可集成 Claude Desktop、Cursor 及任何 MCP 兼容客户端。
