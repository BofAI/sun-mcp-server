# OpenAPI to MCP Server

A tool that creates MCP (Model Context Protocol) servers from OpenAPI/Swagger specifications, enabling AI assistants to interact with your APIs. **Create your own [branded and customized MCPs](#customizing-and-publishing-your-own-version)** for specific APIs or services.

## Overview

This project creates a dynamic MCP server that transforms OpenAPI specifications into MCP tools. It enables seamless integration of REST APIs with AI assistants via the Model Context Protocol, turning any API into an AI-accessible tool.

## Features

- Dynamic loading of OpenAPI specs from file or HTTP/HTTPS URLs
- Support for [OpenAPI Overlays](#openapi-overlays) loaded from files or HTTP/HTTPS URLs
- Customizable mapping of OpenAPI operations to MCP tools
- Advanced filtering of operations using glob patterns for both operationId and URL paths
- Comprehensive parameter handling with format preservation and location metadata
- API authentication handling
- OpenAPI metadata (title, version, description) used to configure the MCP server
- Hierarchical description fallbacks (operation description → operation summary → path summary)
- Custom HTTP headers support via environment variables and CLI
- X-MCP header for API request tracking and identification
- Support for custom `x-mcp` extensions at the path level to override tool names and descriptions
 - Optional **SUN.IO / SUNSWAP helper tools** for TRON balances, quotes, prices, swaps, and V2/V3 liquidity management, all write operations using an explicit get-params → build unsigned transaction → wallet sign → broadcast flow

## Using with AI Assistants

This tool creates an MCP server that allows AI assistants to interact with APIs defined by OpenAPI specifications. The primary way to use it is by configuring your AI assistant to run it directly as an MCP tool.

### Setting Up in Claude Desktop

1. Ensure you have [Node.js](https://nodejs.org/) installed on your computer
2. Open Claude Desktop and navigate to Settings > Developer
3. Edit the configuration file (or it will be created if it doesn't exist):
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

4. Add this configuration (customize as needed):

```json
{
  "mcpServers": {
    "api-tools": {
      "command": "npx",
      "args": [
        "-y",
        "@tyk-technologies/api-to-mcp@latest",
        "--spec",
        "https://petstore3.swagger.io/api/v3/openapi.json"
      ],
      "enabled": true
    }
  }
}
```

5. Restart Claude Desktop
6. You should now see a hammer icon in the chat input box. Click it to access your API tools.

### Customizing the Configuration

You can adjust the `args` array to customize your MCP server with various options:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": [
        "-y",
        "@tyk-technologies/api-to-mcp@latest",
        "--spec",
        "./path/to/your/openapi.json",
        "--overlays",
        "./path/to/overlay.json,https://example.com/api/overlay.json",
        "--whitelist",
        "getPet*,POST:/users/*",
        "--targetUrl",
        "https://api.example.com"
      ],
      "enabled": true
    }
  }
}
```

### Setting Up in Cursor

1. Create a configuration file in one of these locations:
   - Project-specific: `.cursor/mcp.json` in your project directory
   - Global: `~/.cursor/mcp.json` in your home directory

2. Add this configuration (adjust as needed for your API):

```json
{
  "servers": [
    {
      "command": "npx",
      "args": [
        "-y",
        "@tyk-technologies/api-to-mcp@latest",
        "--spec",
        "./path/to/your/openapi.json"
      ],
      "name": "My API Tools"
    }
  ]
}
```

3. Restart Cursor or reload the window

### Using with Vercel AI SDK

You can also use this MCP server directly in your JavaScript/TypeScript applications using the Vercel AI SDK's MCP client:

```javascript
import { experimental_createMCPClient } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Initialize the Google Generative AI provider
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY, // Set your API key in environment variables
});
const model = google('gemini-2.0-flash');

// Create an MCP client with stdio transport
const mcpClient = await experimental_createMCPClient({
  transport: {
    type: 'stdio',
    command: 'npx', // Command to run the MCP server
    args: ['-y', '@tyk-technologies/api-to-mcp', '--spec', 'https://petstore3.swagger.io/api/v3/openapi.json'], // OpenAPI spec
    env: {
      // You can set environment variables here
      // API_KEY: process.env.YOUR_API_KEY,
    },
  },
});

async function main() {
  try {
    // Retrieve tools from the MCP server
    const tools = await mcpClient.tools();

    // Generate text using the AI SDK with MCP tools
    const { text } = await generateText({
      model,
      prompt: 'List all available pets in the pet store using the API.',
      tools, // Pass the MCP tools to the model
    });

    console.log('Generated text:', text);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always close the MCP client to release resources
    await mcpClient.close();
  }
}

main();
```

## Configuration

Configuration is managed via environment variables, command-line options, or a JSON configuration file:

### Command Line Options

```bash
# Start with specific OpenAPI spec file
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json

# Apply overlays to the spec
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json --overlays=./path/to/overlay.json,https://example.com/api/overlay.json

# Include only specific operations (supports glob patterns)
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json --whitelist="getPet*,POST:/users/*"

# Specify target API URL
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json --targetUrl=https://api.example.com

# Set target API timeout (milliseconds)
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json --timeout=30000

# Add custom headers to all API requests
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json --headers='{"X-Api-Version":"1.0.0"}'

# Disable the X-MCP header
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json --disableXMcp

# Start a streamable HTTP MCP endpoint
@tyk-technologies/api-to-mcp --spec=./path/to/openapi.json --transport=streamable-http --host=127.0.0.1 --port=8080 --mcpPath=/mcp
```

### Environment Variables

You can set these in a `.env` file or directly in your environment:

- `OPENAPI_SPEC_PATH`: Path to OpenAPI spec file
- `OPENAPI_OVERLAY_PATHS`: Comma-separated paths to overlay JSON files
- `MCP_TRANSPORT`: MCP transport mode (`stdio` or `streamable-http`)
- `MCP_SERVER_HOST`: Host for streamable HTTP MCP server
- `MCP_SERVER_PORT`: Port for streamable HTTP MCP server
- `MCP_SERVER_PATH`: HTTP path for streamable HTTP MCP endpoint (default: `/mcp`)
- `TARGET_API_BASE_URL`: Base URL for API calls (overrides OpenAPI servers)
- `TARGET_API_TIMEOUT_MS`: Timeout for outbound target API requests in milliseconds (default: `30000`)
- `MCP_WHITELIST_OPERATIONS`: Comma-separated list of operation IDs or URL paths to include (supports glob patterns like `getPet*` or `GET:/pets/*`)
- `MCP_BLACKLIST_OPERATIONS`: Comma-separated list of operation IDs or URL paths to exclude (supports glob patterns, ignored if whitelist used)
- `API_KEY`: API Key for the target API (if required)
- `SECURITY_SCHEME_NAME`: Name of the security scheme requiring the API Key
- `SECURITY_CREDENTIALS`: JSON string containing security credentials for multiple schemes
- `CUSTOM_HEADERS`: JSON string containing custom headers to include in all API requests
- `HEADER_*`: Any environment variable starting with `HEADER_` will be added as a custom header (e.g., `HEADER_X_API_Version=1.0.0` adds the header `X-API-Version: 1.0.0`)
- `DISABLE_X_MCP`: Set to `true` to disable adding the `X-MCP: 1` header to all API requests
- `CONFIG_FILE`: Path to a JSON configuration file

### TRON / SUN.IO Wallet Configuration (SUNSWAP Helpers)

When using the optional SUN.IO / SUNSWAP tools for trading and liquidity management on TRON, the server can obtain a wallet from:

- **Local environment variables** (preferred when set):
  - `TRON_PRIVATE_KEY`: Hex private key (with or without `0x` prefix)
  - `TRON_MNEMONIC`: BIP‑39 mnemonic phrase (12 or 24 words)
  - `TRON_ACCOUNT_INDEX`: Optional HD account index, default `0` (derivation path `m/44'/195'/0'/0/index`)
- **AgentWallet provider**:
  - When running inside an MCP host that exposes an Agent Wallet, the host may inject a provider implementing `getAddress()` and `signAndSendTransaction(unsignedTx)`; the helper `getWallet` will fall back to this provider when no local keys are configured.

The resolution order is:

1. If `TRON_PRIVATE_KEY` or `TRON_MNEMONIC` is set, use a local TRON wallet (via TronGrid endpoints) for signing and broadcasting.
2. Otherwise, require an AgentWallet provider; if neither is available, write operations will fail with a clear error.

All SUNSWAP contract `send` helpers (router swaps, V2 add/remove liquidity, V3 position mint/increase/decrease) strictly follow:

1. **Get transaction parameters** (function name, args, value, ABI/contract address)
2. **Build an unsigned transaction** using TRON transaction builders
3. **Wallet signs and broadcasts** – via local private key or AgentWallet provider.

### SUN.IO / SUNSWAP Helper Tools

This project includes a set of optional tools under the `sunswap_*` namespace, implemented in `src/sunswap` and registered from `src/tools/sunswap.ts`. These tools are designed to work alongside the OpenAPI-generated tools for the `sunio-open-api.json` spec:

- **Wallet & Balances**
  - `sunswap_get_wallet_address`: resolve the active TRON wallet address (local or AgentWallet).
  - `sunswap_get_balances`: query TRX and TRC20 balances for a given wallet.
- **Quotes & Swaps**
  - `sunswap_quote_exact_input`: call SUNSWAP smart router quote functions (e.g. `quoteExactInput` / `getAmountsOut`) for exact-input swap estimates.
  - `sunswap_swap_exact_input`: execute smart router swapExactInput-style swaps using the standard unsigned-tx → sign → broadcast pipeline.
- **Token Prices**
  - `sunswap_get_token_price`: fetch latest token prices from `GET /apiv2/price` on `https://open.sun.io`.
- **Liquidity Management**
  - `sunswap_v2_add_liquidity` / `sunswap_v2_remove_liquidity`: SUNSWAP V2-style add/remove liquidity via router contracts.
  - `sunswap_v3_mint_position`: mint a SUNSWAP V3-style concentrated liquidity position via `NonfungiblePositionManager.mint`.
  - `sunswap_v3_increase_liquidity` / `sunswap_v3_decrease_liquidity`: adjust liquidity for existing V3 positions.

All these helpers are parameterised by contract addresses, function arguments, and (optionally) ABI fragments, so they can be used against different SUNSWAP deployments or forks without recompiling the server.

### JSON Configuration

You can also use a JSON configuration file instead of environment variables or command-line options. The MCP server will look for configuration files in the following order:

1. Path specified by `--config` command-line option
2. Path specified by `CONFIG_FILE` environment variable
3. `config.json` in the current directory
4. `openapi-mcp.json` in the current directory
5. `.openapi-mcp.json` in the current directory

Example JSON configuration file:

```json
{
  "spec": "./path/to/openapi-spec.json",
  "overlays": "./path/to/overlay1.json,https://example.com/api/overlay.json",
  "transport": "streamable-http",
  "host": "127.0.0.1",
  "port": 8080,
  "mcpPath": "/mcp",
  "targetUrl": "https://api.example.com",
  "timeout": 30000,
  "whitelist": "getPets,createPet,/pets/*",
  "blacklist": "deletePet,/admin/*",
  "apiKey": "your-api-key",
  "securitySchemeName": "ApiKeyAuth",
  "securityCredentials": {
    "ApiKeyAuth": "your-api-key",
    "OAuth2": "your-oauth-token"
  },
  "headers": {
    "X-Custom-Header": "custom-value",
    "User-Agent": "OpenAPI-MCP-Client/1.0"
  },
  "disableXMcp": false
}
```

A full example configuration file with explanatory comments is available at `config.example.json` in the root directory.

### Multiple Specs with Per-Spec Settings

You can configure multiple OpenAPI specs in one server process by using `specs`.
Each spec supports independent settings such as `targetUrl`, `overlays`, `timeout`, `whitelist`, `blacklist`, and `headers`.

```json
{
  "transport": "streamable-http",
  "host": "127.0.0.1",
  "port": 8080,
  "mcpPath": "/mcp",
  "headers": {
    "X-Global-Header": "global"
  },
  "specs": [
    {
      "name": "trading",
      "spec": "https://api-a.example.com/openapi.json",
      "targetUrl": "https://api-a.example.com",
      "overlays": "./specs/a-overlay.json",
      "timeout": 15000,
      "whitelist": "getPools,getTokens",
      "headers": {
        "X-Api-Env": "a"
      },
      "toolPrefix": "a_"
    },
    {
      "name": "billing",
      "spec": "https://api-b.example.com/openapi.json",
      "targetUrl": "https://api-b.example.com",
      "overlays": "./specs/b-overlay.json",
      "timeout": 45000,
      "blacklist": "deleteInvoice",
      "headers": {
        "X-Api-Env": "b"
      },
      "toolPrefix": "b_"
    }
  ]
}
```

Notes:
- Per-spec `headers` are merged on top of global `headers`.
- Per-spec `timeout` overrides global `timeout`.
- When `specs` is present, top-level `spec/targetUrl/overlays/whitelist/blacklist` are only used as fallback defaults.

### Configuration Precedence

Configuration settings are applied in the following order of precedence (highest to lowest):

1. Command-line options
2. Environment variables
3. JSON configuration file

## Development

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd api-to-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Local Testing

```bash
# Start the MCP server
npm start

# Development mode with auto-reload
npm run dev

# Start streamable HTTP mode
npm start -- --transport=streamable-http --host=127.0.0.1 --port=8080 --mcpPath=/mcp
```

### Customizing and Publishing Your Own Version

You can use this repository as a base for creating your own customized OpenAPI to MCP server. This section explains how to fork the repository, customize it for your specific APIs, and publish it as a package.

#### Forking and Customizing

1. **Fork the Repository**:
   Fork this repository on GitHub to create your own copy that you can customize.

2. **Add Your OpenAPI Specs**:
   ```bash
   # Create a specs directory if it doesn't exist
   mkdir -p specs
   
   # Add your OpenAPI specifications
   cp path/to/your/openapi-spec.json specs/
   
   # Add any overlay files
   cp path/to/your/overlay.json specs/
   ```

3. **Configure Default Settings**:
   Create a custom config file that will be bundled with your package:
   ```bash
   # Copy the example config
   cp config.example.json config.json
   
   # Edit the config to point to your bundled specs
   # and set any default settings
   ```

4. **Update package.json**:
   ```json
   {
     "name": "your-custom-mcp-server",
     "version": "1.0.0",
     "description": "Your customized MCP server for specific APIs",
     "files": [
       "dist/**/*",
       "config.json",
       "specs/**/*",
       "README.md"
     ]
   }
   ```

5. **Ensure Specs are Bundled**:
   The `files` field in package.json (shown above) ensures your specs and config file will be included in the published package.

#### Customizing the GitHub Workflow

The repository includes a GitHub Actions workflow for automatic publishing to npm. To customize it for your forked repo:

1. **Update the Workflow Name**:
   Edit `.github/workflows/publish-npm.yaml` to update the name if desired:
   ```yaml
   name: Publish My Custom MCP Package
   ```

2. **Set Package Scope (if needed)**:
   If you want to publish under an npm organization scope, uncomment and modify the scope line in the workflow file:
   ```yaml
   - name: Setup Node.js
     uses: actions/setup-node@v4
     with:
       node-version: "18"
       registry-url: "https://registry.npmjs.org/"
       # Uncomment and update with your organization scope:
       scope: "@your-org"
   ```

3. **Set Up npm Token**:
   Add your npm token as a GitHub secret named `NPM_TOKEN` in your forked repository's settings.

#### Publishing Your Customized Package

Once you've customized the repository:

1. **Create and Push a Tag**:
   ```bash
   # Update version in package.json (optional, the workflow will update it based on the tag)
   npm version 1.0.0
   
   # Push the tag
   git push --tags
   ```

2. **GitHub Actions will**:
   - Automatically build the package
   - Update version in package.json to match the tag
   - Publish to npm with your bundled specs and config

## Usage After Publication

Users of your customized package can install and use it with npm:

```bash
# Install your customized package
npm install your-custom-mcp-server -g

# Run it
your-custom-mcp-server
```

They can override your default settings via environment variables or command line options as described in the Configuration section.

## License

MIT

## Contributing

Issues and pull requests are welcome.

Before opening a PR:

1. Run `npm run build`
2. Run `npm test`
3. Include a short note describing behavior changes and any config impacts
