# Installation

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm

## Setup

```bash
git clone <your-repo-url>
cd sun-mcp-server
npm install
npm run build
```

## Running

### stdio Mode (default)

```bash
npm start
```

### HTTP Mode

```bash
npm start -- --transport streamable-http --host 127.0.0.1 --port 8080 --mcpPath /mcp
```

### Development Mode

```bash
npm run dev
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

## Test Scripts

```bash
# V2 add liquidity test
npm run script:test-add-liquidity

# V2 remove liquidity test
npm run script:test-remove-liquidity

# V3 mint position test (auto ticks + single-sided)
npm run script:test-v3-mint

# V3 decrease liquidity test (auto amountMin)
npm run script:test-v3-decrease

# V3 collect fees test
npm run script:test-v3-collect
```

## Unit Tests

```bash
npm test
```
