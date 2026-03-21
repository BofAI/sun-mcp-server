/**
 * Unit tests for SunPump (meme token) trading module
 *
 * These tests verify the SunPump functions from @bankofai/sun-kit.
 * Since the sun-kit functions require a ContractContext, we import the
 * bare functions from sun-kit's internal modules and mock TronWeb.
 */

import { SunKit, SUNPUMP_MAINNET, SUNPUMP_NILE, SunPumpTokenState } from '@bankofai/sun-kit'

const getSunPumpAddress = SunKit.getSunPumpAddress

describe('SunPump', () => {
  describe('getSunPumpAddress', () => {
    it('returns mainnet address for mainnet', () => {
      expect(getSunPumpAddress('mainnet')).toBe(SUNPUMP_MAINNET)
      expect(getSunPumpAddress('tron')).toBe(SUNPUMP_MAINNET)
      expect(getSunPumpAddress('trx')).toBe(SUNPUMP_MAINNET)
    })

    it('returns nile address for testnet', () => {
      expect(getSunPumpAddress('nile')).toBe(SUNPUMP_NILE)
      expect(getSunPumpAddress('testnet')).toBe(SUNPUMP_NILE)
    })

    it('throws for unsupported network', () => {
      expect(() => getSunPumpAddress('ethereum')).toThrow('Unsupported network')
    })
  })

  describe('SunPumpTokenState enum', () => {
    it('has correct values', () => {
      expect(SunPumpTokenState.NOT_EXIST).toBe(0)
      expect(SunPumpTokenState.TRADING).toBe(1)
      expect(SunPumpTokenState.LAUNCHED).toBe(2)
    })
  })

  describe('SUNPUMP addresses', () => {
    it('mainnet address is valid TRON format', () => {
      expect(SUNPUMP_MAINNET).toBeTruthy()
      expect(SUNPUMP_MAINNET).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('nile address is valid TRON format', () => {
      expect(SUNPUMP_NILE).toBeTruthy()
      expect(SUNPUMP_NILE).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('mainnet and nile addresses are different', () => {
      expect(SUNPUMP_MAINNET).not.toBe(SUNPUMP_NILE)
    })
  })
})
