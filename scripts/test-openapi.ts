#!/usr/bin/env npx ts-node
/**
 * 本地测试 OpenAPI 规范加载与处理。
 *
 * 默认使用 specs/sunio-open-api.json，可通过环境变量覆盖：
 *   OPENAPI_SPEC_PATH=path/to/spec.json
 *   OPENAPI_OVERLAY_PATHS=path/to/overlay.json (可选)
 *
 * 运行：npx ts-node scripts/test-openapi.ts
 *
 * 可选：测试真实 API 调用
 *   npx ts-node scripts/test-openapi.ts --fetch
 */

import path from "path";

// 必须在导入 openapiProcessor 之前设置，否则 config 会因缺少 spec 而退出
process.env.OPENAPI_SPEC_PATH =
  process.env.OPENAPI_SPEC_PATH || path.resolve(process.cwd(), "specs/sunio-open-api.json");

const shouldFetch = process.argv.includes("--fetch");

async function main() {
  console.log("=== OpenAPI Test ===");
  console.log("OPENAPI_SPEC_PATH:", process.env.OPENAPI_SPEC_PATH);
  console.log("");

  // 动态导入，确保 env 已设置
  const { getProcessedOpenApi } = await import("../src/openapiProcessor");

  console.log("--- Step 1: Load and process OpenAPI spec ---");
  let spec: any;
  try {
    spec = await getProcessedOpenApi();
    console.log("OK: Spec loaded successfully");
    console.log("  openapi:", spec.openapi);
    console.log("  info.title:", spec.info?.title);
    console.log("  info.version:", spec.info?.version);
    console.log("  paths count:", Object.keys(spec.paths || {}).length);
    console.log("");
  } catch (err: any) {
    console.error("Error loading spec:", err?.message);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }

  if (shouldFetch) {
    console.log("--- Step 2: Test real API call (GET /apiv2/price) ---");
    const baseUrl = spec.servers?.[0]?.url || "https://open.sun.io";
    const url = `${baseUrl}/apiv2/price?symbol=TRX,USDT`;
    console.log("URL:", url);
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log("Status:", res.status);
      console.log("Response:", JSON.stringify(data, null, 2));
    } catch (err: any) {
      console.error("Fetch error:", err?.message);
      process.exit(1);
    }
  } else {
    console.log("Tip: Add --fetch to test a real API call (GET /apiv2/price)");
  }
}

main();
