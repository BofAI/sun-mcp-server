import {
  getSqrtRatioAtTick,
  maxLiquidityForAmounts,
  getAmountsForLiquidity,
  nearestUsableTick,
  FEE_TICK_SPACING,
} from "../../src/sunswap/v3Math";

describe("v3Math", () => {
  describe("getSqrtRatioAtTick", () => {
    it("returns Q96 at tick 0", () => {
      const q96 = 1n << 96n;
      const ratio = getSqrtRatioAtTick(0);
      expect(ratio).toBe(q96);
    });

    it("positive ticks produce larger values than Q96", () => {
      const q96 = 1n << 96n;
      expect(getSqrtRatioAtTick(100)).toBeGreaterThan(q96);
      expect(getSqrtRatioAtTick(1000)).toBeGreaterThan(getSqrtRatioAtTick(100));
    });

    it("negative ticks produce smaller values than Q96", () => {
      const q96 = 1n << 96n;
      expect(getSqrtRatioAtTick(-100)).toBeLessThan(q96);
      expect(getSqrtRatioAtTick(-1000)).toBeLessThan(getSqrtRatioAtTick(-100));
    });

    it("throws for out-of-bounds tick", () => {
      expect(() => getSqrtRatioAtTick(887273)).toThrow("out of bounds");
      expect(() => getSqrtRatioAtTick(-887273)).toThrow("out of bounds");
    });

    it("handles max/min ticks", () => {
      expect(getSqrtRatioAtTick(887272)).toBeGreaterThan(0n);
      expect(getSqrtRatioAtTick(-887272)).toBeGreaterThan(0n);
    });
  });

  describe("nearestUsableTick", () => {
    it("rounds to nearest multiple of tickSpacing", () => {
      expect(nearestUsableTick(10, 60)).toBe(0);
      expect(nearestUsableTick(30, 60)).toBe(60);
      expect(nearestUsableTick(-29, 60)).toBe(-0);
      expect(nearestUsableTick(-31, 60)).toBe(-60);
    });

    it("clamps to min/max tick", () => {
      expect(nearestUsableTick(-900000, 60)).toBe(-887272);
      expect(nearestUsableTick(900000, 60)).toBe(887272);
    });
  });

  describe("maxLiquidityForAmounts / getAmountsForLiquidity round-trip", () => {
    it("round-trips for in-range position", () => {
      const sqrtPrice = getSqrtRatioAtTick(0);
      const sqrtA = getSqrtRatioAtTick(-1000);
      const sqrtB = getSqrtRatioAtTick(1000);
      const a0 = 1000000n;
      const a1 = 1000000n;

      const liq = maxLiquidityForAmounts(sqrtPrice, sqrtA, sqrtB, a0, a1);
      expect(liq).toBeGreaterThan(0n);

      const amts = getAmountsForLiquidity(sqrtPrice, sqrtA, sqrtB, liq);
      expect(amts.amount0).toBeGreaterThan(0n);
      expect(amts.amount1).toBeGreaterThan(0n);
      expect(amts.amount0).toBeLessThanOrEqual(a0);
      expect(amts.amount1).toBeLessThanOrEqual(a1);
    });

    it("all-token0 when price below range", () => {
      const sqrtPrice = getSqrtRatioAtTick(-2000);
      const sqrtA = getSqrtRatioAtTick(-1000);
      const sqrtB = getSqrtRatioAtTick(1000);

      const liq = maxLiquidityForAmounts(sqrtPrice, sqrtA, sqrtB, 1000000n, 0n);
      const amts = getAmountsForLiquidity(sqrtPrice, sqrtA, sqrtB, liq);
      expect(amts.amount0).toBeGreaterThan(0n);
      expect(amts.amount1).toBe(0n);
    });

    it("all-token1 when price above range", () => {
      const sqrtPrice = getSqrtRatioAtTick(2000);
      const sqrtA = getSqrtRatioAtTick(-1000);
      const sqrtB = getSqrtRatioAtTick(1000);

      const liq = maxLiquidityForAmounts(sqrtPrice, sqrtA, sqrtB, 0n, 1000000n);
      const amts = getAmountsForLiquidity(sqrtPrice, sqrtA, sqrtB, liq);
      expect(amts.amount0).toBe(0n);
      expect(amts.amount1).toBeGreaterThan(0n);
    });
  });

  describe("FEE_TICK_SPACING", () => {
    it("has standard V3 fee tiers", () => {
      expect(FEE_TICK_SPACING[500]).toBe(10);
      expect(FEE_TICK_SPACING[3000]).toBe(60);
      expect(FEE_TICK_SPACING[10000]).toBe(200);
    });
  });
});
