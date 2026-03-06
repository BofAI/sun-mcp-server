import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerSunswapTools } from "../src/tools/sunswap";

// Basic smoke tests to ensure SUNSWAP tools register and invoke without throwing.

describe("SUNSWAP tools registration", () => {
  it("registers sunswap tools on an MCP server", async () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });

    const registered: string[] = [];
    const registerTool = (
      name: string,
      definition: { description?: string; inputSchema?: z.ZodRawShape },
      handler: (params: any) => Promise<any>,
    ) => {
      registered.push(name);
      const paramsSchema = (definition.inputSchema || {}) as z.ZodRawShape;
      if (definition.description) {
        (server.tool as any)(name, definition.description, paramsSchema, handler);
      } else {
        (server.tool as any)(name, paramsSchema, handler);
      }
    };

    registerSunswapTools(registerTool);

    expect(registered).toEqual(
      expect.arrayContaining([
        "sunswap_get_wallet_address",
        "sunswap_read_contract",
        "sunswap_send_contract",
        "sunswap_get_balances",
        "sunswap_quote_exact_input",
        "sunswap_swap_exact_input",
        "sunswap_get_token_price",
        "sunswap_v2_add_liquidity",
        "sunswap_v2_remove_liquidity",
        "sunswap_v3_mint_position",
        "sunswap_v3_increase_liquidity",
        "sunswap_v3_decrease_liquidity",
      ]),
    );
  });
});

