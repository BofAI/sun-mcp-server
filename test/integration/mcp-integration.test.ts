import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { mapOpenApiToMcpTools } from "../../src/mcpMapper";
import { createTestApiCallDetails } from "../utils/testTypes";
import { executeApiCall, mockApiError, resetApiMock } from "../mocks/apiClient.mock";
import { testConfig } from "../fixtures/test-config";

const originalEnv = { ...process.env };

jest.mock("../../src/apiClient", () => ({
  executeApiCall,
}));

describe("SUN.IO MCP Integration Tests", () => {
  let openApiSpec: any;

  beforeAll(async () => {
    const content = await fs.readFile(path.resolve(process.cwd(), testConfig.openApiFile), "utf-8");
    openApiSpec = JSON.parse(content);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetApiMock();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("contains expected SUN.IO operations in spec", () => {
    expect(openApiSpec.openapi).toBe("3.0.1");
    expect(openApiSpec.info.title).toBe("SUN.IO API v2");
    expect(openApiSpec.paths["/apiv2/price"].get.operationId).toBe("getPrice");
    expect(openApiSpec.paths["/apiv2/pools"].get.operationId).toBe("getPools");
  });

  it("maps SUN.IO spec to tools", () => {
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: { whitelist: null, blacklist: [] },
    });

    expect(mappedTools.length).toBeGreaterThan(20);
    const names = mappedTools.map((tool) => tool.mcpToolDefinition.name);
    expect(names).toContain("getPrice");
    expect(names).toContain("getPools");
  });

  it("executes API call mock successfully", async () => {
    executeApiCall.mockImplementationOnce(async () => ({
      success: true,
      statusCode: 200,
      data: testConfig.mockResponses.getPrice,
      headers: new Headers({ "Content-Type": "application/json" }),
    }));

    const apiCallDetails = createTestApiCallDetails({
      method: "GET",
      pathTemplate: "/apiv2/price",
      serverUrl: testConfig.baseUrl,
      operationId: "getPrice",
    });

    const result = await executeApiCall(apiCallDetails, { symbol: "SUN" });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual(testConfig.mockResponses.getPrice);
  });

  it("handles API error responses", async () => {
    mockApiError(404, { error: "Not found" });

    const apiCallDetails = createTestApiCallDetails({
      method: "GET",
      pathTemplate: "/apiv2/pools",
      serverUrl: testConfig.baseUrl,
      operationId: "getPools",
    });

    const result = await executeApiCall(apiCallDetails, { poolAddress: "TNONEXISTENT" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.data).toEqual({ error: "Not found" });
  });

  it("can register mapped tools into an MCP server instance", () => {
    const server = new McpServer({ name: "SUN.IO Test Server", version: "1.0.0" });
    const mappedTools = mapOpenApiToMcpTools(openApiSpec, {
      targetApiBaseUrl: testConfig.baseUrl,
      filter: { whitelist: ["getPrice", "getPools"], blacklist: [] },
    });

    for (const tool of mappedTools) {
      server.tool(tool.mcpToolDefinition.name, tool.mcpToolDefinition.description, async () => ({
        content: [{ type: "text", text: JSON.stringify({ success: true }) }],
      }));
    }

    expect(server).toBeDefined();
  });
});
