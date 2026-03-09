# 安装指南

## 前置要求

- [Node.js](https://nodejs.org/) 20+
- npm

## 安装步骤

```bash
git clone <your-repo-url>
cd sun-mcp-server
npm install
npm run build
```

## 运行

### stdio 模式（默认）

```bash
npm start
```

### HTTP 模式

```bash
npm start -- --transport streamable-http --host 127.0.0.1 --port 8080 --mcpPath /mcp
```

### 开发模式

```bash
npm run dev
```

## 客户端集成

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sun-mcp-server": {
      "command": "node",
      "args": ["/绝对路径/sun-mcp-server/dist/src/server.js"],
      "env": {
        "OPENAPI_SPEC_PATH": "/绝对路径/sun-mcp-server/specs/sunio-open-api.json",
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
      "args": ["/绝对路径/sun-mcp-server/dist/src/server.js"],
      "env": {
        "OPENAPI_SPEC_PATH": "/绝对路径/sun-mcp-server/specs/sunio-open-api.json",
        "TARGET_API_BASE_URL": "https://open.sun.io"
      }
    }
  ]
}
```

## 测试脚本

```bash
# V2 添加流动性测试
npm run script:test-add-liquidity

# V2 移除流动性测试
npm run script:test-remove-liquidity

# V3 铸造仓位测试（自动 ticks + 单边输入）
npm run script:test-v3-mint

# V3 减少流动性测试（自动 amountMin）
npm run script:test-v3-decrease

# V3 领取手续费测试
npm run script:test-v3-collect
```

## 单元测试

```bash
npm test
```
