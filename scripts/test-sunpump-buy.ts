/**
 * Test script for SunPump meme token buy (bonding curve)
 *
 * Usage: npm run script:test-sunpump-buy
 *
 * Make sure to:
 * 1. Configure wallet env: npm run wallet:setup
 * 2. Have TRX balance in wallet
 * 3. Update TOKEN_ADDRESS to a valid SunPump token
 */

import dotenv from 'dotenv'
dotenv.config()

import { SunKit } from '@bankofai/sun-kit'
import { getWalletAddress, initWallet, getWallet, isWalletConfigured } from '../src/wallet'

const NETWORK = 'nile'
const TOKEN_ADDRESS = 'TAsJEbT9URv9TCZukeuuhG21tywNzvn6P5'
const TRX_AMOUNT = '1000000' // 1 TRX
const SLIPPAGE = 0.05 // 5%

async function main() {
  console.log('=== SunPump Buy Test ===\n')

  await initWallet()
  if (!isWalletConfigured()) {
    console.error('Error: No wallet configured.')
    console.error('Run: npm run wallet:setup')
    process.exit(1)
  }
  const wallet = getWallet()
  const kit = new SunKit({ wallet, network: NETWORK })

  const walletAddress = await getWalletAddress()
  console.log(`Wallet: ${walletAddress}`)
  console.log(`Network: ${NETWORK}`)
  console.log(`Token: ${TOKEN_ADDRESS}`)
  console.log(`TRX Amount: ${Number(TRX_AMOUNT) / 1e6} TRX\n`)

  console.log('--- Step 1: Getting Token Info ---')
  try {
    const tokenInfo = await kit.getSunPumpTokenInfo(TOKEN_ADDRESS, NETWORK)
    console.log('Token Info:')
    console.log(`  State: ${tokenInfo.state} (0=not exist, 1=trading, 2=launched)`)
    console.log(`  Price: ${tokenInfo.price}`)
    console.log(`  TRX Reserve: ${Number(tokenInfo.trxReserve) / 1e6} TRX`)
    console.log(`  Token Reserve: ${tokenInfo.tokenReserve}`)
    console.log(`  Launched to DEX: ${tokenInfo.launched}\n`)

    if (tokenInfo.state === 0) {
      console.error('Token does not exist on SunPump.')
      process.exit(1)
    }
    if (tokenInfo.launched) {
      console.error('Token has already launched to DEX. Use SunSwap V2 for trading.')
      process.exit(1)
    }
  } catch (error) {
    console.error('Failed to get token info:', error)
    process.exit(1)
  }

  console.log('--- Step 2: Getting Quote ---')
  try {
    const quote = await kit.sunpumpQuoteBuy(TOKEN_ADDRESS, TRX_AMOUNT, NETWORK)
    console.log('Quote:')
    console.log(`  Expected Tokens: ${quote.tokenAmount}`)
    console.log(`  Fee: ${Number(quote.fee) / 1e6} TRX\n`)
  } catch (error) {
    console.error('Failed to get quote:', error)
    process.exit(1)
  }

  console.log('--- Step 3: Current Token Balance ---')
  try {
    const balance = await kit.getMemeTokenBalance(TOKEN_ADDRESS, walletAddress, NETWORK)
    console.log(`Current Balance: ${balance}\n`)
  } catch (error) {
    console.log('Could not fetch balance (token may not exist in wallet yet)\n')
  }

  console.log('--- Step 4: Executing Buy ---')
  console.log('WARNING: This will spend real TRX. Press Ctrl+C to cancel.')
  console.log('Waiting 5 seconds...\n')

  await new Promise((resolve) => setTimeout(resolve, 5000))

  try {
    const result = await kit.sunpumpBuy({
      tokenAddress: TOKEN_ADDRESS,
      trxAmount: TRX_AMOUNT,
      slippage: SLIPPAGE,
      network: NETWORK,
    })

    console.log('Buy Result:')
    console.log(`  TX Result: ${JSON.stringify(result.txResult, null, 2)}`)
    console.log(`  TRX Spent: ${Number(result.trxSpent) / 1e6} TRX`)
    console.log(`  Expected Tokens: ${result.expectedTokens}`)
    console.log(`  Min Token Out: ${result.minTokenOut}\n`)
  } catch (error) {
    console.error('Buy failed:', error)
    process.exit(1)
  }

  console.log('--- Step 5: New Token Balance ---')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  try {
    const newBalance = await kit.getMemeTokenBalance(TOKEN_ADDRESS, walletAddress, NETWORK)
    console.log(`New Balance: ${newBalance}\n`)
  } catch (error) {
    console.error('Failed to get new balance:', error)
  }

  console.log('=== Buy Test Complete ===')
}

main().catch(console.error)
