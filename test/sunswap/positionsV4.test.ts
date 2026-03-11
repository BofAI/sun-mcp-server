import {
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
} from "../../src/sunswap/constants";

// Mock the wallet module to avoid ESM module issues
jest.mock("../../src/wallet", () => ({
  getWalletAddress: jest.fn().mockResolvedValue("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"),
  isLocalWalletConfigured: jest.fn().mockReturnValue(false),
  getWallet: jest.fn(),
  getConfiguredLocalWallet: jest.fn(),
}));

// Mock contracts module
jest.mock("../../src/sunswap/contracts", () => ({
  getReadonlyTronWeb: jest.fn().mockResolvedValue({
    address: {
      toHex: (addr: string) => {
        if (addr === "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf") return "41e552f6487585c2b58bc2c9bb4492bc1f17132cd0";
        if (addr === "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK") return "414d1c0b5a5c7b1e91f0a5c5a9b5c5d5e5f5a5b5c5";
        return "41" + addr.slice(1);
      },
    },
    transactionBuilder: {
      triggerConstantContract: jest.fn(),
    },
    utils: {
      abi: {
        decodeParams: jest.fn(),
      },
    },
    contract: jest.fn(),
  }),
  sendContractTx: jest.fn().mockResolvedValue({ txid: "mock-txid" }),
  transferTokenTo: jest.fn().mockResolvedValue({ txid: "mock-transfer-txid" }),
}));

import {
  getCLPositionManagerAddress,
  getPoolManagerAddress,
} from "../../src/sunswap/positionsV4";

describe("positionsV4", () => {
  describe("CLPositionManager addresses", () => {
    it("mainnet address is valid TRON format", () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).toBeTruthy();
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/);
    });

    it("nile address is valid TRON format", () => {
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).toBeTruthy();
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/);
    });

    it("mainnet and nile addresses are different", () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).not.toBe(
        SUNSWAP_V4_NILE_CL_POSITION_MANAGER
      );
    });
  });

  describe("PoolManager addresses", () => {
    it("mainnet address is valid TRON format", () => {
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).toBeTruthy();
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/);
    });

    it("nile address is valid TRON format", () => {
      expect(SUNSWAP_V4_NILE_POOL_MANAGER).toBeTruthy();
      expect(SUNSWAP_V4_NILE_POOL_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/);
    });

    it("mainnet and nile addresses are different", () => {
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).not.toBe(
        SUNSWAP_V4_NILE_POOL_MANAGER
      );
    });
  });

  describe("address consistency", () => {
    it("mainnet CLPositionManager and PoolManager are different", () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).not.toBe(
        SUNSWAP_V4_MAINNET_POOL_MANAGER
      );
    });

    it("nile CLPositionManager and PoolManager are different", () => {
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).not.toBe(
        SUNSWAP_V4_NILE_POOL_MANAGER
      );
    });
  });

  describe("getCLPositionManagerAddress", () => {
    it("returns mainnet address for mainnet", () => {
      expect(getCLPositionManagerAddress("mainnet")).toBe(
        SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER
      );
    });

    it("returns mainnet address for tron", () => {
      expect(getCLPositionManagerAddress("tron")).toBe(
        SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER
      );
    });

    it("returns mainnet address for trx", () => {
      expect(getCLPositionManagerAddress("trx")).toBe(
        SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER
      );
    });

    it("returns nile address for nile", () => {
      expect(getCLPositionManagerAddress("nile")).toBe(
        SUNSWAP_V4_NILE_CL_POSITION_MANAGER
      );
    });

    it("returns nile address for testnet", () => {
      expect(getCLPositionManagerAddress("testnet")).toBe(
        SUNSWAP_V4_NILE_CL_POSITION_MANAGER
      );
    });

    it("is case insensitive", () => {
      expect(getCLPositionManagerAddress("MAINNET")).toBe(
        SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER
      );
      expect(getCLPositionManagerAddress("Nile")).toBe(
        SUNSWAP_V4_NILE_CL_POSITION_MANAGER
      );
    });

    it("throws for unsupported network", () => {
      expect(() => getCLPositionManagerAddress("ethereum")).toThrow(
        /Unsupported network/
      );
    });
  });

  describe("getPoolManagerAddress", () => {
    it("returns mainnet address for mainnet", () => {
      expect(getPoolManagerAddress("mainnet")).toBe(
        SUNSWAP_V4_MAINNET_POOL_MANAGER
      );
    });

    it("returns mainnet address for tron", () => {
      expect(getPoolManagerAddress("tron")).toBe(
        SUNSWAP_V4_MAINNET_POOL_MANAGER
      );
    });

    it("returns nile address for nile", () => {
      expect(getPoolManagerAddress("nile")).toBe(
        SUNSWAP_V4_NILE_POOL_MANAGER
      );
    });

    it("returns nile address for testnet", () => {
      expect(getPoolManagerAddress("testnet")).toBe(
        SUNSWAP_V4_NILE_POOL_MANAGER
      );
    });

    it("is case insensitive", () => {
      expect(getPoolManagerAddress("MAINNET")).toBe(
        SUNSWAP_V4_MAINNET_POOL_MANAGER
      );
      expect(getPoolManagerAddress("NILE")).toBe(
        SUNSWAP_V4_NILE_POOL_MANAGER
      );
    });

    it("throws for unsupported network", () => {
      expect(() => getPoolManagerAddress("bsc")).toThrow(
        /Unsupported network/
      );
    });
  });
});

describe("positionsV4 parameter validation", () => {
  const {
    increaseLiquidityV4,
    decreaseLiquidityV4,
  } = require("../../src/sunswap/positionsV4");

  describe("increaseLiquidityV4", () => {
    it("throws when token0 is missing", async () => {
      await expect(
        increaseLiquidityV4({
          network: "nile",
          tokenId: "1",
          token1: "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK",
          amount0Desired: "1000000",
        })
      ).rejects.toThrow(/token0 and token1 are required/);
    });

    it("throws when token1 is missing", async () => {
      await expect(
        increaseLiquidityV4({
          network: "nile",
          tokenId: "1",
          token0: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
          amount0Desired: "1000000",
        })
      ).rejects.toThrow(/token0 and token1 are required/);
    });
  });

  describe("decreaseLiquidityV4", () => {
    it("throws when token0 is missing", async () => {
      await expect(
        decreaseLiquidityV4({
          network: "nile",
          tokenId: "1",
          liquidity: "1000000",
          token1: "TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK",
        })
      ).rejects.toThrow(/token0 and token1 are required/);
    });

    it("throws when token1 is missing", async () => {
      await expect(
        decreaseLiquidityV4({
          network: "nile",
          tokenId: "1",
          liquidity: "1000000",
          token0: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
        })
      ).rejects.toThrow(/token0 and token1 are required/);
    });
  });
});

describe("positionsV4 FEE_TICK_SPACING mapping", () => {
  const { FEE_TICK_SPACING } = require("../../src/sunswap/v3Math");

  it("has correct tick spacing for fee 100", () => {
    expect(FEE_TICK_SPACING[100]).toBe(1);
  });

  it("has correct tick spacing for fee 500", () => {
    expect(FEE_TICK_SPACING[500]).toBe(10);
  });

  it("has correct tick spacing for fee 3000", () => {
    expect(FEE_TICK_SPACING[3000]).toBe(60);
  });

  it("has correct tick spacing for fee 10000", () => {
    expect(FEE_TICK_SPACING[10000]).toBe(200);
  });

  it("returns undefined for unknown fee", () => {
    expect(FEE_TICK_SPACING[999]).toBeUndefined();
  });
});
