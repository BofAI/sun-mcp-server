import {
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
  SunKit,
} from '@bankofai/sun-kit'
import { FEE_TICK_SPACING } from '@bankofai/sun-kit/dist/kit/v3-math'

const getCLPositionManagerAddress = SunKit.getCLPositionManagerAddress
const getPoolManagerAddress = SunKit.getPoolManagerAddress

describe('positionsV4', () => {
  describe('CLPositionManager addresses', () => {
    it('mainnet address is valid TRON format', () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('nile address is valid TRON format', () => {
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('mainnet and nile addresses are different', () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).not.toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })
  })

  describe('PoolManager addresses', () => {
    it('mainnet address is valid TRON format', () => {
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('nile address is valid TRON format', () => {
      expect(SUNSWAP_V4_NILE_POOL_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_NILE_POOL_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('mainnet and nile addresses are different', () => {
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).not.toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })
  })

  describe('address consistency', () => {
    it('mainnet CLPositionManager and PoolManager are different', () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).not.toBe(SUNSWAP_V4_MAINNET_POOL_MANAGER)
    })

    it('nile CLPositionManager and PoolManager are different', () => {
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).not.toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })
  })

  describe('getCLPositionManagerAddress', () => {
    it('returns mainnet address for mainnet', () => {
      expect(getCLPositionManagerAddress('mainnet')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
    })

    it('returns mainnet address for tron', () => {
      expect(getCLPositionManagerAddress('tron')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
    })

    it('returns mainnet address for trx', () => {
      expect(getCLPositionManagerAddress('trx')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
    })

    it('returns nile address for nile', () => {
      expect(getCLPositionManagerAddress('nile')).toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })

    it('returns nile address for testnet', () => {
      expect(getCLPositionManagerAddress('testnet')).toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })

    it('is case insensitive', () => {
      expect(getCLPositionManagerAddress('MAINNET')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
      expect(getCLPositionManagerAddress('Nile')).toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })

    it('throws for unsupported network', () => {
      expect(() => getCLPositionManagerAddress('ethereum')).toThrow(/Unsupported network/)
    })
  })

  describe('getPoolManagerAddress', () => {
    it('returns mainnet address for mainnet', () => {
      expect(getPoolManagerAddress('mainnet')).toBe(SUNSWAP_V4_MAINNET_POOL_MANAGER)
    })

    it('returns mainnet address for tron', () => {
      expect(getPoolManagerAddress('tron')).toBe(SUNSWAP_V4_MAINNET_POOL_MANAGER)
    })

    it('returns nile address for nile', () => {
      expect(getPoolManagerAddress('nile')).toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })

    it('returns nile address for testnet', () => {
      expect(getPoolManagerAddress('testnet')).toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })

    it('is case insensitive', () => {
      expect(getPoolManagerAddress('MAINNET')).toBe(SUNSWAP_V4_MAINNET_POOL_MANAGER)
      expect(getPoolManagerAddress('NILE')).toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })

    it('throws for unsupported network', () => {
      expect(() => getPoolManagerAddress('bsc')).toThrow(/Unsupported network/)
    })
  })
})

describe('positionsV4 FEE_TICK_SPACING mapping', () => {
  it('has correct tick spacing for fee 100', () => {
    expect(FEE_TICK_SPACING[100]).toBe(1)
  })

  it('has correct tick spacing for fee 500', () => {
    expect(FEE_TICK_SPACING[500]).toBe(10)
  })

  it('has correct tick spacing for fee 3000', () => {
    expect(FEE_TICK_SPACING[3000]).toBe(60)
  })

  it('has correct tick spacing for fee 10000', () => {
    expect(FEE_TICK_SPACING[10000]).toBe(200)
  })

  it('returns undefined for unknown fee', () => {
    expect(FEE_TICK_SPACING[999]).toBeUndefined()
  })
})
