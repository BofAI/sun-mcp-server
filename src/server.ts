import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config";
import { getProcessedOpenApi } from "./openapiProcessor";
import { mapOpenApiToMcpTools } from "./mcpMapper";
import { executeApiCall } from "./apiClient";
import type { MappedTool, RegisterToolFn } from "./types";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { z } from "zod";
import { registerSunswapTools } from "./tools";

async function startServer() {
  console.error("Starting Dynamic OpenAPI MCP Server...");

  const openapiSpecs: any[] = [];
  let mappedTools: MappedTool[] = [];
  try {
    for (const [index, specCfg] of config.specConfigs.entries()) {
      console.error(
        `Loading spec [${index + 1}/${config.specConfigs.length}] from: ${specCfg.specPath}`,
      );
      const openapiSpec = await getProcessedOpenApi(specCfg);
      openapiSpecs.push(openapiSpec);

      const mapped = mapOpenApiToMcpTools(openapiSpec, {
        targetApiBaseUrl: specCfg.targetApiBaseUrl,
        requestTimeoutMs: specCfg.requestTimeoutMs,
        customHeaders: specCfg.customHeaders,
        disableXMcp: specCfg.disableXMcp,
        filter: specCfg.filter,
        toolPrefix: specCfg.toolPrefix,
      });
      mappedTools = mappedTools.concat(mapped);
    }
  } catch (error) {
    console.error(
      "Failed to initialize/mapping OpenAPI specifications. Server cannot start.",
      error,
    );
    process.exit(1);
  }

  if (mappedTools.length === 0) {
    console.error(
      "No tools were mapped from the configured specs based on current configuration/filtering.",
    );
  }
  if (openapiSpecs.length === 0) {
    console.error("No OpenAPI specs available after processing. Server cannot start.");
    process.exit(1);
  }

  const primarySpec = openapiSpecs[0];

  // Construct the server with metadata from OpenAPI spec
  const server = new McpServer({
    name:
      config.specConfigs.length > 1
        ? "OpenAPI to MCP Generator (Multi-Spec)"
        : primarySpec.info?.title || "OpenAPI to MCP Generator",
    version: primarySpec.info?.version || "1.0.0",
  });

  if (primarySpec.info?.description) {
    console.error(`API Description: ${primarySpec.info.description}`);
  }

  // Register each tool with the server
  const registeredToolNames = new Set<string>();
  const registerTool: RegisterToolFn = (name, definition, handler) => {
    if (registeredToolNames.has(name)) {
      console.error(
        `Skipping duplicate tool name: ${name}. Use 'toolPrefix' in specs config to avoid collisions.`,
      );
      return;
    }
    registeredToolNames.add(name);

    try {
      const paramsSchema = (definition.inputSchema || {}) as z.ZodRawShape;
      if (definition.description) {
        (server.tool as any)(name, definition.description, paramsSchema, async (toolParams: any) =>
          handler(toolParams),
        );
      } else {
        (server.tool as any)(name, paramsSchema, async (toolParams: any) => handler(toolParams));
      }
      console.error(`Registered Tool: ${name}`);
    } catch (registerError) {
      console.error(`Failed to register tool ${name}:`, registerError);
    }
  };

  // Register custom tools from src/tools
  registerSunswapTools(registerTool);

  for (const tool of mappedTools) {
    const { mcpToolDefinition, apiCallDetails } = tool;
    console.error(`Registering MCP tool: ${mcpToolDefinition.name}`);

    try {
      // Convert JSON Schema properties to zod schema
      const params: any = {};

      if (mcpToolDefinition.inputSchema && mcpToolDefinition.inputSchema.properties) {
        // Loop through all properties and create appropriate Zod schemas based on data type
        for (const [propName, propSchema] of Object.entries(
          mcpToolDefinition.inputSchema.properties,
        )) {
          if (typeof propSchema !== "object") continue;

          const description = (propSchema.description as string) || `Parameter: ${propName}`;
          const required = mcpToolDefinition.inputSchema.required?.includes(propName) || false;

          // Map JSON Schema types to Zod schema types
          let zodSchema;
          const schemaType = Array.isArray(propSchema.type)
            ? propSchema.type[0] // If type is an array (for nullable union types), use first type
            : propSchema.type;

          // Handle different types with proper Zod schemas
          switch (schemaType) {
            case "integer":
              zodSchema = z.number().int().describe(description);
              break;
            case "number":
              zodSchema = z.number().describe(description);
              break;
            case "boolean":
              zodSchema = z.boolean().describe(description);
              break;
            case "object":
              // For objects, create a more permissive schema
              zodSchema = z.object({}).passthrough().describe(description);
              break;
            case "array":
              // For arrays, allow any array content
              zodSchema = z.array(z.any()).describe(description);
              break;
            case "string":
            default:
              zodSchema = z.string().describe(description);
              break;
          }

          // Make it optional if not required
          params[propName] = required ? zodSchema : zodSchema.optional();
        }
      }

      // Register the tool using unified registration entry point
      registerTool(
        mcpToolDefinition.name,
        {
          inputSchema: params,
          description: mcpToolDefinition.description,
          annotations: {
            title: mcpToolDefinition.name,
          },
        },
        async (toolParams: any) => {
          try {
            const result = await executeApiCall(apiCallDetails, toolParams);

            if (result.success) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result.data),
                  },
                ],
              };
            } else {
              // Map API errors to MCP errors
              let errorCode = ErrorCode.InternalError;
              let errorMessage = result.error || `API Error ${result.statusCode}`;

              if (result.statusCode === 400) {
                errorCode = ErrorCode.InvalidParams;
                errorMessage = `Invalid parameters: ${result.error}`;
              } else if (result.statusCode === 404) {
                errorCode = ErrorCode.InvalidParams;
                errorMessage = `Resource not found: ${result.error}`;
              }

              throw new McpError(errorCode, errorMessage, result.data);
            }
          } catch (invocationError: any) {
            if (invocationError instanceof McpError) {
              throw invocationError;
            }

            throw new McpError(
              ErrorCode.InternalError,
              `Internal server error: ${invocationError.message}`,
            );
          }
        },
      );
    } catch (registerError) {
      console.error(`Failed to register tool ${mcpToolDefinition.name}:`, registerError);
    }
  }

  console.error("Starting MCP server...");

  try {
    if (config.transport === "streamable-http") {
      const transport = new StreamableHTTPServerTransport({
        // Stateless mode keeps the setup simple and client-compatible.
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);

      const httpServer = createServer(async (req, res) => {
        try {
          const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
          if (requestUrl.pathname !== config.mcpPath) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not found" }));
            return;
          }
          await transport.handleRequest(req, res);
        } catch (requestError: any) {
          console.error("Error handling HTTP MCP request:", requestError);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
          }
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });

      await new Promise<void>((resolve, reject) => {
        httpServer.on("error", reject);
        httpServer.listen(config.mcpPort, config.mcpHost, () => resolve());
      });

      console.error(`MCP Server started and ready for connections`);
      console.error(`Listening on http://${config.mcpHost}:${config.mcpPort}${config.mcpPath}`);
      return;
    }

    // Default transport is stdio for local MCP clients.
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`MCP Server started and ready for connections`);
  } catch (error) {
    console.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

export { startServer };

// Only auto-start if this is the main module
if (require.main === module) {
  startServer().catch((error) => {
    console.error("Unhandled error during server startup:", error);
    process.exit(1);
  });
}
