// Test configuration file
export const testConfig = {
  openApiFile: "specs/sunio-open-api.json",
  overlayFile: "specs/sunio-overlay.json",
  baseUrl: "https://open.sun.io",
  tools: {
    includeOperationIds: ["getPrice", "getPools"],
    excludeOperationIds: [],
  },
  server: {
    port: 9000,
    host: "localhost",
  },
  headers: {
    "X-Test-Header": "test-value",
    "X-API-Version": "2.0.0",
  },
  disableXMcp: false,
  mockResponses: {
    getPrice: {
      code: 0,
      msg: "success",
      data: {
        SUN: "0.0245",
        TRX: "0.1342",
      },
    },
    getPools: {
      code: 0,
      msg: "success",
      data: {
        list: [
          { poolAddress: "TPOOL123", reserveUsd: "123456.78", protocol: "V3" },
          { poolAddress: "TPOOL456", reserveUsd: "65432.10", protocol: "V2" },
        ],
        total: 2,
      },
    },
  },
};
