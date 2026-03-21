#!/usr/bin/env npx ts-node
/**
 * 本地测试 V2 添加流动性，输出详细错误，便于排查 HTTP 500。
 *
 * 使用前请在项目根目录配置 .env，例如：
 *   AGENT_WALLET_PRIVATE_KEY=你的十六进制私钥
 * 或 AGENT_WALLET_MNEMONIC=助记词
 *
 * 运行：npx ts-node scripts/test-add-liquidity.ts
 */

import 'dotenv/config'
import { SunKit, SUNSWAP_V2_NILE_ROUTER } from '@bankofai/sun-kit'
import { initWallet, getWallet, isWalletConfigured } from '../src/wallet'

const NETWORK = 'nile'
const ROUTER = SUNSWAP_V2_NILE_ROUTER
const TOKEN_A = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
const TOKEN_B = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'
const AMOUNT_A = '1000000'
const AMOUNT_B = '2248333'

async function main() {
  console.log('AGENT_WALLET_PRIVATE_KEY set:', !!process.env.AGENT_WALLET_PRIVATE_KEY)
  console.log('AGENT_WALLET_MNEMONIC set:', !!process.env.AGENT_WALLET_MNEMONIC)
  console.log('network:', NETWORK, 'router:', ROUTER)
  console.log('tokenA:', TOKEN_A, 'tokenB:', TOKEN_B)
  console.log('amountADesired:', AMOUNT_A, 'amountBDesired:', AMOUNT_B)
  console.log('')

  await initWallet()
  if (!isWalletConfigured()) {
    console.error('No wallet configured. Set AGENT_WALLET_PRIVATE_KEY or AGENT_WALLET_MNEMONIC.')
    process.exit(1)
  }

  const kit = new SunKit({ wallet: getWallet(), network: NETWORK })

  try {
    const result = await kit.addLiquidityV2({
      network: NETWORK,
      routerAddress: ROUTER,
      tokenA: TOKEN_A,
      tokenB: TOKEN_B,
      amountADesired: AMOUNT_A,
      amountBDesired: AMOUNT_B,
    })
    console.log('Success:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    console.error('Full error:', err)
    if (err?.stack) console.error('Stack:\n', err.stack)
    if (err?.cause) console.error('Cause:', err.cause)
    process.exit(1)
  }
}

main()
