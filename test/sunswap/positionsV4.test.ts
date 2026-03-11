import {
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
} from "../../src/sunswap/constants";

describe("positionsV4 constants", () => {
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
});
