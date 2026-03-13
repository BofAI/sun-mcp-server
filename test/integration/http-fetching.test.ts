/**
 * HTTP fetching tests without opening local sockets.
 * We mock fetchFromUrl to keep tests deterministic in sandboxed CI.
 */

import { jest } from "@jest/globals";
import path from "path";
import fs from "fs/promises";

describe("HTTP Fetching Tests (SUN.IO)", () => {
  const specUrl = "https://fixtures.local/sunio-open-api.json";
  const overlayUrl = "https://fixtures.local/sunio-overlay.json";
  let specContent = "";
  let overlayContent = "";

  beforeAll(async () => {
    const specPath = path.resolve(process.cwd(), "specs/sunio-open-api.json");
    const overlayPath = path.resolve(process.cwd(), "specs/sunio-overlay.json");
    specContent = await fs.readFile(specPath, "utf8");
    overlayContent = await fs.readFile(overlayPath, "utf8");
  });

  beforeEach(() => {
    jest.resetModules();
  });

  it("fetches SUN.IO OpenAPI spec via HTTP URL", async () => {
    jest.doMock("../../src/config", () => ({
      config: {
        specPath: specUrl,
        overlayPaths: [],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        customHeaders: {},
        disableXMcp: false,
        filter: {
          whitelist: null,
          blacklist: [],
        },
      },
    }));

    jest.doMock("../../src/utils/httpClient", () => ({
      isHttpUrl: (value: string) => value.startsWith("http://") || value.startsWith("https://"),
      fetchFromUrl: jest.fn(async (url: string) => {
        if (url === specUrl) return specContent;
        throw new Error(`Unexpected URL: ${url}`);
      }),
    }));

    const { getProcessedOpenApi } = require("../../src/openapiProcessor");
    const openApiSpec = await getProcessedOpenApi();

    expect(openApiSpec.openapi).toBe("3.0.1");
    expect(openApiSpec.info.title).toBe("SUN.IO API v2");
    expect(openApiSpec.paths["/apiv2/price"]).toBeDefined();
  });

  it("fetches SUN.IO overlay via HTTP URL", async () => {
    const localSpecPath = path.resolve(process.cwd(), "specs/sunio-open-api.json");

    jest.doMock("../../src/config", () => ({
      config: {
        specPath: localSpecPath,
        overlayPaths: [overlayUrl],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        customHeaders: {},
        disableXMcp: false,
        filter: {
          whitelist: null,
          blacklist: [],
        },
      },
    }));

    jest.doMock("../../src/utils/httpClient", () => ({
      isHttpUrl: (value: string) => value.startsWith("http://") || value.startsWith("https://"),
      fetchFromUrl: jest.fn(async (url: string) => {
        if (url === overlayUrl) return overlayContent;
        throw new Error(`Unexpected URL: ${url}`);
      }),
    }));

    const { getProcessedOpenApi } = require("../../src/openapiProcessor");
    const openApiSpec = await getProcessedOpenApi();

    expect(openApiSpec.info.description).toContain("MCP-oriented descriptions");
    expect(openApiSpec.paths["/apiv2/pools"].get.summary).toBe("Get SUNSWAP pools with filters");
    expect(openApiSpec.paths["/apiv2/price"].get.summary).toBe("Get SUNSWAP token prices");
  });

  it("fetches both spec and overlay via HTTP URLs", async () => {
    jest.doMock("../../src/config", () => ({
      config: {
        specPath: specUrl,
        overlayPaths: [overlayUrl],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        customHeaders: {},
        disableXMcp: false,
        filter: {
          whitelist: null,
          blacklist: [],
        },
      },
    }));

    jest.doMock("../../src/utils/httpClient", () => ({
      isHttpUrl: (value: string) => value.startsWith("http://") || value.startsWith("https://"),
      fetchFromUrl: jest.fn(async (url: string) => {
        if (url === specUrl) return specContent;
        if (url === overlayUrl) return overlayContent;
        throw new Error(`Unexpected URL: ${url}`);
      }),
    }));

    const { getProcessedOpenApi } = require("../../src/openapiProcessor");
    const openApiSpec = await getProcessedOpenApi();

    expect(openApiSpec.openapi).toBe("3.0.1");
    expect(openApiSpec.paths["/apiv2/price"]).toBeDefined();
    expect(openApiSpec.paths["/apiv2/pools"].get.summary).toBe("Get SUNSWAP pools with filters");
  });
});
