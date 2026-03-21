#!/usr/bin/env npx ts-node
/**
 * 本地测试 V3 Mint Position（自动 tickLower/Upper + 单边输入自动算另一边）。
 *
 * 使用前请在项目根目录配置 .env：
 *   AGENT_WALLET_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v3-mint.ts
 */

import 'dotenv/config'
import { SunKit } from '@bankofai/sun-kit'
import { SUNSWAP_V3_NILE_POSITION_MANAGER } from '@bankofai/sun-kit'
import { initWallet, getWallet, isWalletConfigured } from '../src/wallet'

const NETWORK = 'nile'
const PM = SUNSWAP_V3_NILE_POSITION_MANAGER
const TOKEN_0 = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
const TOKEN_1 = 'TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK'
const FEE = 500

async function main() {
  await initWallet()
  if (!isWalletConfigured()) {
    console.error(
      'Error: No wallet configured. Set AGENT_WALLET_PRIVATE_KEY or AGENT_WALLET_MNEMONIC in .env',
    )
    process.exit(1)
  }
  const wallet = getWallet()
  const kit = new SunKit({ wallet, network: NETWORK })

  console.log('=== V3 Mint Position Test ===')
  console.log('AGENT_WALLET_PRIVATE_KEY set:', !!process.env.AGENT_WALLET_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('positionManager:', PM)
  console.log('token0:', TOKEN_0)
  console.log('token1:', TOKEN_1)
  console.log('fee:', FEE)
  console.log('')

  console.log('--- Mint (single-sided: amount0Desired only, auto ticks) ---')
  try {
    const result = await kit.mintPositionV3({
      network: NETWORK,
      positionManagerAddress: PM,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      amount0Desired: '10000000',
    })

    console.log('Mint result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    if (err?.stack) console.error('Stack:\n', err.stack)
    process.exit(1)
  }
}

main()
