Dynamic OpenAPI to MCP Tool Server

**1. Introduction & Goal**

The primary goal of this project is to create a Node.js application (written in TypeScript) that functions as a **dynamic Model Context Protocol (MCP) server**. This server will read a standard OpenAPI specification, optionally apply OpenAPI Overlays, and then **dynamically define and expose the API operations as MCP tools at runtime**. It acts as a live bridge or shim, translating between the MCP protocol and the underlying HTTP API, without generating static code files. This allows existing APIs described by OpenAPI to be seamlessly integrated into MCP-compatible environments and used by AI agents or other MCP clients.

**2. Core Functionality**

The application will perform the following main tasks:

*   **Input:** Accept an OpenAPI specification (v3.x recommended) as input (e.g., path to a local JSON/YAML file).
*   **Overlay Application:** Support the application of one or more OpenAPI Overlays to the base specification *in memory* before processing.
*   **Parsing:** Parse the (potentially overlaid) OpenAPI specification to extract details required for both defining the MCP tools and executing the underlying API calls:
    *   API Information (`info`: title, description, version) - now used directly to configure the MCP server.
    *   Server URLs (`servers`).
    *   Paths and Operations (HTTP methods: GET, POST, PUT, DELETE, etc.).
    *   Operation details (`operationId`, `summary`, `description`).
    *   Parameters (path, query, header, cookie - including name, description, required, schema/type).
    *   Request Bodies (description, required, content types, schemas).
    *   Responses (descriptions, status codes, content types, schemas - primarily focusing on success responses for `outputSchema`).
    *   Security Schemes (`components.securitySchemes`) and operation-level security requirements (`security`).
*   **Filtering:** Allow selective inclusion/exclusion of specific API operations based on glob patterns for both `operationId` and URL paths (HTTP method + path) via configuration, determining which operations become exposed as MCP tools.
*   **Dynamic Tool Definition:** For each included OpenAPI operation, dynamically construct an MCP tool definition *in memory* using the `@modelcontextprotocol/sdk`. This involves mapping OpenAPI elements to MCP tool properties based on the following guidelines:
    *   **MCP `name`:** Use the OpenAPI `operationId`. If missing, generate a unique name based on the HTTP method and path. Custom `x-mcp.name` extension at the path level can override this name if specified.
    *   **MCP `description`:** Use the OpenAPI operation `description` / `summary` / `pathItem.summary`. Priority order: operation description → operation summary → path summary → default. Custom `x-mcp.description` extension at the path level can override this description if specified.
    *   **MCP `inputSchema`:** Generate a JSON Schema object based on the OpenAPI operation's `parameters` (query, path, header, cookie) and `requestBody` schema. Include descriptions, types, formats, constraints (min/max, required, nullable), and parameter location metadata.
    *   **MCP `outputSchema`:** (Optional but recommended) Generate a JSON Schema object based on the primary success response schema (e.g., 200 OK, 201 Created) defined in the OpenAPI operation's `responses`.
    *   **MCP `annotations`:** (Optional) Potentially add annotations like `title` from OpenAPI `info`, or custom hints.
*   **Runtime API Call Information:** Store the necessary details (target server URL, specific path, HTTP method, security requirements) associated with each dynamically defined MCP tool to enable runtime execution.
*   **MCP Server Runtime:**
    *   Instantiate an MCP server using the `@modelcontextprotocol/sdk`.
    *   Register the dynamically created tool definitions with this server instance.
    *   Start the server, listening for MCP JSON-RPC requests.
*   **Tool Execution Handling (Shim Functionality):**
    *   When the server receives an MCP request to execute a specific tool:
        *   Retrieve the associated API call details (URL, method, path, security).
        *   Map the incoming MCP `input` parameters to the corresponding HTTP request elements (path parameters, query string, headers, request body).
        *   Construct and send the HTTP request to the target API endpoint.
        *   Handle authentication/authorization based on configured security credentials.
        *   Translate the HTTP response (status code, body) back into an MCP tool execution result (or error response).

**3. Technical Requirements**

*   **Language:** TypeScript
*   **Runtime:** Node.js (specify version range, e.g., LTS)
*   **Key Dependencies:**
    *   **Model Context Protocol (MCP) SDK:** `@modelcontextprotocol/sdk` (for server creation and tool definition).
    *   **OpenAPI Parser:** Robust library like `@apidevtools/swagger-parser`.
    *   **OpenAPI Overlay Library:** `openapi-overlays-js` (for programmatic overlay application).
    *   **HTTP Client:** Library for making outgoing HTTP requests (e.g., `axios`, `node-fetch`, or built-in `fetch`).
    *   **Glob Pattern Matching:** Library like `minimatch` for glob pattern support in filtering.
    *   Argument Parsing (optional, for CLI config): e.g., `yargs`, `commander`.

**4. Features in Detail**

*   **OpenAPI Spec Input:** Handle JSON/YAML formats; basic validation.
*   **Dynamic Overlay Application:** Use `openapi-overlays-js` to apply overlays programmatically before tool definition.
*   **Filtering:** Configurable whitelist/blacklist for operations using glob patterns matching `operationId` or method+path format (e.g., `GET:/pets/*`).
*   **Dynamic MCP Tool Definition & Server Setup:** Use MCP SDK to create server and tool objects *in memory* based on parsed OpenAPI data and the mapping table.
*   **Advanced Parameter Handling:**
    *   Preserve OpenAPI parameter formats (date, date-time, uuid, etc.)
    *   Support nullable parameters while maintaining required status
    *   Include parameter location metadata (path, query, header, cookie)
    *   Preserve additional properties and vendor extensions
*   **HTTP Header Management**:
    *   Support for custom headers provided via environment variables (prefixed with `HEADER_`)
    *   Support for custom headers provided via CLI arguments and configuration
    *   Automatic inclusion of `X-MCP: 1` header with configurable toggle to disable it
*   **Runtime API Invocation:**
    *   Correctly construct target API URLs based on OpenAPI `servers` (may need configuration to select a specific server URL if multiple are present).
    *   Accurately map MCP input parameters to HTTP request path, query, headers, and body.
    *   Implement handling for common security schemes defined in OpenAPI (e.g., API Key in header/query, Bearer Token) - requires configuration for providing actual credentials.
    *   Translate API responses (e.g., 2xx success body -> MCP result; 4xx/5xx errors -> MCP error).
*   **Configuration:** Mechanism (e.g., config file, environment variables) to specify:
    *   Path to the OpenAPI specification file.
    *   Paths to overlay files (optional).
    *   Filtering rules with glob pattern support (optional).
    *   Credentials/secrets required for API security schemes.
    *   Custom HTTP headers to include in all API calls
    *   Option to disable the X-MCP header
    *   Selected server URL if multiple are defined in the spec.
    *   Port for the MCP server to listen on.

**5. Non-Functional Requirements**

*   **Error Handling:** Robust handling of invalid specs, file errors, overlay errors, network errors during API calls, configuration issues, and translation errors. Provide clear MCP error responses.
*   **Security:** Securely handle API credentials passed via configuration/environment. Do not expose secrets in logs or MCP responses.
*   **Performance:** Be mindful of the latency introduced by the shim layer (parsing, request/response translation, network hop).
*   **Logging:** Provide configurable logging for debugging and monitoring (e.g., incoming MCP requests, outgoing API calls, errors).
*   **Code Quality:** Clean, well-documented, type-safe TypeScript code.
*   **Testing:** Unit/integration tests covering parsing, overlay application, tool definition mapping, API call execution, security handling, and error translation.

**6. Mapping Summary (Reiteration from Notes)**

| MCP Tool Element | OpenAPI Source Field(s)                   | Notes                                                                |
| :--------------- | :---------------------------------------- | :------------------------------------------------------------------- |
| `name`           | `operationId`                             | Unique, machine-friendly; fallback to method/path combination        |
| `description`    | `operation.description` / `operation.summary` / `pathItem.summary` | Priority order: operation description → operation summary → path summary → default |
| `inputSchema`    | `parameters`, `requestBody`               | JSON Schema derived from API inputs; includes types, descriptions, formats, and metadata |
| `outputSchema`   | `responses` (primary success schema)      | JSON Schema derived from expected successful API output              |
| *Internal*       | `servers`, `path`, `method`               | Used by the shim to construct and make the actual HTTP request       |
| *Internal*       | `security`, `components.securitySchemes`  | Used by the shim to apply authentication/authorization to API calls |
