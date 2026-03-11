// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTronWebInstance = {
  address: {
    fromHex: jest.fn((hex: string) => `base58_${hex}`),
  },
  defaultAddress: {} as any,
};

const MockTronWebCtor = jest.fn(() => mockTronWebInstance);

jest.mock("tronweb", () => ({
  TronWeb: MockTronWebCtor,
}));

jest.mock("../../src/sunswap/chains", () => ({
  getNetworkConfig: jest.fn((network: string) => ({
    fullNode: `https://${network}.trongrid.io`,
    solidityNode: `https://${network}.trongrid.io`,
    eventServer: `https://${network}.trongrid.io`,
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { getReadonlyTronWeb } from "../../src/wallet/tronweb";

function cleanEnv() {
  delete process.env.TRONGRID_API_KEY;
  delete process.env.TRON_GRID_API_KEY;
}

beforeEach(() => {
  cleanEnv();
  jest.clearAllMocks();
  mockTronWebInstance.defaultAddress = {};
});
afterAll(cleanEnv);

describe("getReadonlyTronWeb", () => {
  it("creates a TronWeb instance with correct network config", async () => {
    const tw = await getReadonlyTronWeb("mainnet");

    expect(MockTronWebCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        fullHost: "https://mainnet.trongrid.io",
        solidityNode: "https://mainnet.trongrid.io",
        eventServer: "https://mainnet.trongrid.io",
      }),
    );
    expect(tw).toBe(mockTronWebInstance);
  });

  it("passes API key header when TRONGRID_API_KEY is set", async () => {
    process.env.TRONGRID_API_KEY = "my-key";
    await getReadonlyTronWeb("mainnet");

    const callArgs = (MockTronWebCtor.mock.calls as any[])[0][0];
    expect(callArgs.headers).toEqual({ "TRON-PRO-API-KEY": "my-key" });
  });

  it("passes API key header when TRON_GRID_API_KEY is set", async () => {
    process.env.TRON_GRID_API_KEY = "fallback-key";
    await getReadonlyTronWeb("mainnet");

    const callArgs = (MockTronWebCtor.mock.calls as any[])[0][0];
    expect(callArgs.headers).toEqual({ "TRON-PRO-API-KEY": "fallback-key" });
  });

  it("omits headers when no API key is set", async () => {
    await getReadonlyTronWeb("mainnet");

    const callArgs = (MockTronWebCtor.mock.calls as any[])[0][0];
    expect(callArgs.headers).toBeUndefined();
  });

  it("sets defaultAddress to zero address for read-only mode", async () => {
    await getReadonlyTronWeb("mainnet");

    const zeroHex = "410000000000000000000000000000000000000000";
    expect(mockTronWebInstance.defaultAddress.hex).toBe(zeroHex);
    expect(mockTronWebInstance.defaultAddress.base58).toBe(`base58_${zeroHex}`);
  });

  it("uses the requested network", async () => {
    await getReadonlyTronWeb("nile");

    expect(MockTronWebCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        fullHost: "https://nile.trongrid.io",
      }),
    );
  });
});
