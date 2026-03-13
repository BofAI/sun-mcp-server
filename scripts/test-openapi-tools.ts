#!/usr/bin/env npx ts-node
/**
 * Smoke test for all OpenAPI-generated SUN.IO endpoints (the ones registered as MCP tools).
 *
 * This script:
 * - Loads the bundled OpenAPI spec via getProcessedOpenApi
 * - Uses the first server URL (or TARGET_API_BASE_URL if configured)
 * - Sends simple GET requests to each documented endpoint with reasonable sample query params
 * - Logs HTTP status and a short snippet of the JSON response
 *
 * It does NOT go through the MCP layer; it hits the underlying SUN.IO HTTP API directly.
 *
 * Usage:
 *   npm run script:test-openapi-tools
 */

import "dotenv/config";
import path from "path";

// Ensure OPENAPI_SPEC_PATH is set before importing openapiProcessor/config
process.env.OPENAPI_SPEC_PATH =
  process.env.OPENAPI_SPEC_PATH || path.resolve(process.cwd(), "specs/sunio-open-api.json");

type TestCase = {
  name: string;
  path: string;
  description?: string;
};

async function main() {
  console.log("=== SUN.IO OpenAPI Endpoints Smoke Test ===");
  console.log("OPENAPI_SPEC_PATH:", process.env.OPENAPI_SPEC_PATH);
  console.log("");

  const { getProcessedOpenApi } = await import("../src/openapiProcessor");

  console.log("--- Step 1: Load OpenAPI spec ---");
  const spec = await getProcessedOpenApi();
  const baseUrl: string = spec.servers?.[0]?.url || process.env.TARGET_API_BASE_URL || "";

  if (!baseUrl) {
    console.error("Error: Could not determine baseUrl from spec.servers or TARGET_API_BASE_URL.");
    process.exit(1);
  }

  console.log("Using baseUrl:", baseUrl);
  console.log("");

  const tests: TestCase[] = [
    // Transactions
    {
      name: "scanTransactions",
      path: "/apiv2/transactions/scan?protocol=ALL&pageSize=1&pageNum=1",
    },
    // Tokens
    {
      name: "getTokens",
      path: "/apiv2/tokens?protocol=V3&pageSize=1&pageNum=1",
    },
    {
      name: "searchTokens",
      path: "/apiv2/tokens/search?keyword=TRX&pageSize=1&pageNum=1",
    },
    // Protocols
    {
      name: "getProtocol",
      path: "/apiv2/protocols?protocol=V3",
    },
    {
      name: "getVolHistory",
      path: "/apiv2/protocols/history/vol?protocol=V3&startDate=2024-01-01&endDate=2024-01-02",
    },
    {
      name: "getLiqHistory",
      path: "/apiv2/protocols/history/liq?protocol=V3&startDate=2024-01-01&endDate=2024-01-02",
    },
    {
      name: "getUsersCountHistory",
      path:
        "/apiv2/protocols/history/usersCount?protocol=V3&startDate=2024-01-01&endDate=2024-01-02",
    },
    {
      name: "getTransactionsHistory",
      path:
        "/apiv2/protocols/history/transactions?protocol=V3&startDate=2024-01-01&endDate=2024-01-02",
    },
    {
      name: "getPoolsCountHistory",
      path:
        "/apiv2/protocols/history/poolsCount?protocol=V3&startDate=2024-01-01&endDate=2024-01-02",
    },
    // Prices
    {
      name: "getPrice",
      path: "/apiv2/price?symbol=TRX,USDT",
    },
    // Positions
    {
      name: "getUserPositions",
      path:
        "/apiv2/positions/user?userAddress=TGjmQxcRHwPJ3NKfPNs1zRkGWJDmMDQiE6&protocol=ALL&pageNo=1&pageSize=1",
    },
    {
      name: "getPoolUserPositionTick",
      path:
        "/apiv2/positions/tick?poolAddress=TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE&pageNo=1&pageSize=1",
    },
    // Pools
    {
      name: "getPools",
      path: "/apiv2/pools?protocol=V3&pageNo=1&pageSize=1",
    },
    {
      name: "searchPools",
      path: "/apiv2/pools/search?keyword=TRX&pageNo=1&pageSize=1",
    },
    {
      name: "searchCountPools",
      path: "/apiv2/pools/search/count?keyword=TRX",
    },
    {
      name: "getTopApyPoolList",
      path: "/apiv2/pools/top_apy_list?pageNo=1&pageSize=1",
    },
    {
      name: "getPoolHooks",
      path: "/apiv2/pools/hooks?protocol=V4",
    },
    {
      name: "getPoolVolHistory",
      path:
        "/apiv2/pools/history/vol?poolAddress=TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE&startDate=2024-01-01&endDate=2024-01-02",
    },
    {
      name: "getPoolLiqHistory",
      path:
        "/apiv2/pools/history/liq?poolAddress=TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE&startDate=2024-01-01&endDate=2024-01-02",
    },
    // Pairs
    {
      name: "getPairsFromEntity",
      path: "/apiv2/pairs?tokenAddress=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&pageNo=1&pageSize=1",
    },
    // Farms
    {
      name: "getFarms",
      path: "/apiv2/farms?pageNo=1&pageSize=1",
    },
    {
      name: "getFarmTransactions",
      path:
        "/apiv2/farms/transactions?farmAddress=TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE&pageNo=1&pageSize=1",
    },
    {
      name: "getFarmPositions",
      path:
        "/apiv2/farms/positions/user?userAddress=TGjmQxcRHwPJ3NKfPNs1zRkGWJDmMDQiE6&pageNo=1&pageSize=1",
    },
  ];

  console.log(`--- Step 2: Running ${tests.length} HTTP GET tests ---`);
  console.log("");

  for (const test of tests) {
    const url = `${baseUrl}${test.path}`;
    console.log(`>>> [${test.name}] ${url}`);
    try {
      const res = await fetch(url);
      const status = res.status;
      let snippet: string;

      try {
        const json = await res.json();
        const text = JSON.stringify(json);
        snippet = text.length > 400 ? `${text.slice(0, 400)}...` : text;
      } catch {
        const text = await res.text();
        snippet = text.length > 400 ? `${text.slice(0, 400)}...` : text;
      }

      console.log(`Status: ${status}`);
      console.log(`Body (truncated): ${snippet}`);
    } catch (err) {
      console.error(`Error calling ${test.name}:`, (err as Error).message);
    }
    console.log("");
  }

  console.log("=== OpenAPI endpoint smoke test completed ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

