#!/usr/bin/env npx ts-node
/**
 * 本地测试 V3 Increase Liquidity（追加流动性）。
 *
 * 使用前请在项目根目录配置 .env：
 *   AGENT_WALLET_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v3-increase.ts
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

/** 替换为你实际持有的 V3 position tokenId */
const TOKEN_ID = '519'

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

  console.log('=== V3 Increase Liquidity Test ===')
  console.log('AGENT_WALLET_PRIVATE_KEY set:', !!process.env.AGENT_WALLET_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('positionManager:', PM)
  console.log('tokenId:', TOKEN_ID)
  console.log('token0:', TOKEN_0, 'token1:', TOKEN_1, 'fee:', FEE)
  console.log('')

  console.log('--- Increase liquidity ---')
  try {
    const result = await kit.increaseLiquidityV3({
      network: NETWORK,
      positionManagerAddress: PM,
      tokenId: TOKEN_ID,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      amount0Desired: '5000000',
    })

    console.log('Increase result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: unknown) {
    const error = err as Error
    console.error('Error name:', error?.name)
    console.error('Error message:', error?.message)
    if (error?.stack) console.error('Stack:\n', error.stack)
    process.exit(1)
  }
}

main()
