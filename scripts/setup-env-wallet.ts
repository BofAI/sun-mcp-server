#!/usr/bin/env ts-node
/**
 * Script to configure an env-based wallet for sun-mcp-server.
 *
 * Usage:
 *   npx ts-node scripts/setup-env-wallet.ts [command]
 *
 * Commands:
 *   generate       Generate a new mnemonic and derive address
 *   from-mnemonic  Derive address from existing mnemonic (interactive)
 *   from-key       Validate and show address from private key (interactive)
 *   show           Show current wallet configuration
 *   save           Save configuration to .env file (interactive)
 */

import 'dotenv/config'
import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { HDKey } from '@scure/bip32'
import { TronWeb } from 'tronweb'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const ENV_FILE = path.join(__dirname, '..', '.env')

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

function generateMnemonic(): string {
  return bip39.generateMnemonic(wordlist, 128)
}

function deriveFromMnemonic(
  mnemonic: string,
  accountIndex = 0,
): { privateKey: string; address: string } {
  if (!bip39.validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic')
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const hdKey = HDKey.fromMasterSeed(seed)
  const child = hdKey.derive(`m/44'/195'/0'/0/${accountIndex}`)

  if (!child.privateKey) {
    throw new Error('Failed to derive private key')
  }

  const privateKey = Buffer.from(child.privateKey).toString('hex')
  const address = TronWeb.address.fromPrivateKey(privateKey)

  return { privateKey, address: address as string }
}

function addressFromPrivateKey(privateKey: string): string {
  const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
  const address = TronWeb.address.fromPrivateKey(cleanKey)
  if (!address) {
    throw new Error('Invalid private key')
  }
  return address
}

function readEnvFile(): Record<string, string> {
  const env: Record<string, string> = {}
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=')
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex)
          const value = trimmed.substring(eqIndex + 1)
          env[key] = value
        }
      }
    }
  }
  return env
}

function writeEnvFile(env: Record<string, string>): void {
  const lines: string[] = []
  for (const [key, value] of Object.entries(env)) {
    lines.push(`${key}=${value}`)
  }
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n')
}

async function cmdGenerate(): Promise<void> {
  console.log('\nGenerating new wallet...\n')

  const mnemonic = generateMnemonic()
  const { privateKey, address } = deriveFromMnemonic(mnemonic, 0)

  console.log('='.repeat(60))
  console.log('IMPORTANT: Save this mnemonic phrase securely.')
  console.log('='.repeat(60))
  console.log('\nMnemonic (12 words):')
  console.log(`   ${mnemonic}\n`)
  console.log('Private Key:')
  console.log(`   ${privateKey}\n`)
  console.log("Address (m/44'/195'/0'/0/0):")
  console.log(`   ${address}\n`)
  console.log('='.repeat(60))

  console.log('\nTo use this wallet, add one of the following to your .env file:\n')
  console.log('Option 1 - Using mnemonic (recommended):')
  console.log(`   AGENT_WALLET_MNEMONIC="${mnemonic}"`)
  console.log('   AGENT_WALLET_MNEMONIC_ACCOUNT_INDEX=0\n')
  console.log('Option 2 - Using private key:')
  console.log(`   AGENT_WALLET_PRIVATE_KEY=${privateKey}\n`)
}

async function cmdFromMnemonic(): Promise<void> {
  const rl = createReadline()

  try {
    console.log('\nDerive wallet from mnemonic\n')

    const mnemonic = await prompt(rl, 'Enter your mnemonic (12/24 words): ')
    const indexStr = await prompt(rl, 'Account index [0]: ')
    const accountIndex = indexStr ? parseInt(indexStr, 10) : 0

    if (isNaN(accountIndex) || accountIndex < 0) {
      throw new Error('Invalid account index')
    }

    const { privateKey, address } = deriveFromMnemonic(mnemonic, accountIndex)

    console.log('\n' + '='.repeat(60))
    console.log(`Derived Address (m/44'/195'/0'/0/${accountIndex}):`)
    console.log(`   ${address}\n`)
    console.log('Private Key:')
    console.log(`   ${privateKey}\n`)
    console.log('='.repeat(60))

    const save = await prompt(rl, '\nSave to .env file? [y/N]: ')
    if (save.toLowerCase() === 'y') {
      const env = readEnvFile()
      delete env.AGENT_WALLET_PRIVATE_KEY
      env.AGENT_WALLET_MNEMONIC = mnemonic
      env.AGENT_WALLET_MNEMONIC_ACCOUNT_INDEX = accountIndex.toString()
      writeEnvFile(env)
      console.log('Saved to .env file')
    }
  } finally {
    rl.close()
  }
}

async function cmdFromKey(): Promise<void> {
  const rl = createReadline()

  try {
    console.log('\nValidate private key\n')

    const privateKey = await prompt(rl, 'Enter your private key: ')
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey

    const address = addressFromPrivateKey(cleanKey)

    console.log('\n' + '='.repeat(60))
    console.log('Valid private key')
    console.log(`Address: ${address}\n`)
    console.log('='.repeat(60))

    const save = await prompt(rl, '\nSave to .env file? [y/N]: ')
    if (save.toLowerCase() === 'y') {
      const env = readEnvFile()
      delete env.AGENT_WALLET_MNEMONIC
      delete env.AGENT_WALLET_MNEMONIC_ACCOUNT_INDEX
      env.AGENT_WALLET_PRIVATE_KEY = cleanKey
      writeEnvFile(env)
      console.log('Saved to .env file')
    }
  } finally {
    rl.close()
  }
}

async function cmdShow(): Promise<void> {
  console.log('\nCurrent wallet configuration\n')

  const env = readEnvFile()

  if (env.AGENT_WALLET_PRIVATE_KEY) {
    try {
      const address = addressFromPrivateKey(env.AGENT_WALLET_PRIVATE_KEY)
      console.log('Mode: Private Key')
      console.log(`Address: ${address}`)
      console.log(`Private Key: ${env.AGENT_WALLET_PRIVATE_KEY.substring(0, 8)}...`)
    } catch {
      console.log('Invalid AGENT_WALLET_PRIVATE_KEY in .env')
    }
  } else if (env.AGENT_WALLET_MNEMONIC) {
    try {
      const accountIndex = parseInt(env.AGENT_WALLET_MNEMONIC_ACCOUNT_INDEX || '0', 10)
      const { address } = deriveFromMnemonic(env.AGENT_WALLET_MNEMONIC, accountIndex)
      console.log('Mode: Mnemonic')
      console.log(`Address: ${address}`)
      console.log(`Account Index: ${accountIndex}`)
      console.log(`Mnemonic: ${env.AGENT_WALLET_MNEMONIC.split(' ').slice(0, 3).join(' ')}...`)
    } catch {
      console.log('Invalid AGENT_WALLET_MNEMONIC in .env')
    }
  } else {
    console.log('No wallet configured in .env')
    console.log('Run: npx ts-node scripts/setup-env-wallet.ts generate')
  }

  if (env.TRON_GRID_API_KEY) {
    console.log(`\nTronGrid API Key: ${env.TRON_GRID_API_KEY.substring(0, 8)}...`)
  }

  console.log('')
}

async function cmdSave(): Promise<void> {
  const rl = createReadline()

  try {
    console.log('\nSave wallet configuration to .env\n')

    const mode = await prompt(rl, 'Mode [1=private key, 2=mnemonic]: ')

    const env = readEnvFile()

    if (mode === '1') {
      const privateKey = await prompt(rl, 'Enter private key: ')
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
      addressFromPrivateKey(cleanKey)

      delete env.AGENT_WALLET_MNEMONIC
      delete env.AGENT_WALLET_MNEMONIC_ACCOUNT_INDEX
      env.AGENT_WALLET_PRIVATE_KEY = cleanKey
    } else if (mode === '2') {
      const mnemonic = await prompt(rl, 'Enter mnemonic: ')
      const indexStr = await prompt(rl, 'Account index [0]: ')
      const accountIndex = indexStr ? parseInt(indexStr, 10) : 0

      deriveFromMnemonic(mnemonic, accountIndex)

      delete env.AGENT_WALLET_PRIVATE_KEY
      env.AGENT_WALLET_MNEMONIC = mnemonic
      env.AGENT_WALLET_MNEMONIC_ACCOUNT_INDEX = accountIndex.toString()
    } else {
      console.log('Invalid mode')
      return
    }

    const apiKey = await prompt(rl, 'TronGrid API Key (optional, press Enter to skip): ')
    if (apiKey) {
      env.TRON_GRID_API_KEY = apiKey
    }

    writeEnvFile(env)
    console.log('\nConfiguration saved to .env')

    await cmdShow()
  } finally {
    rl.close()
  }
}

function printUsage(): void {
  console.log(`
Usage: npx ts-node scripts/setup-env-wallet.ts [command]

Commands:
  generate       Generate a new mnemonic and show derived address
  from-mnemonic  Derive address from existing mnemonic (interactive)
  from-key       Validate private key and show address (interactive)
  show           Show current wallet configuration from .env
  save           Save wallet configuration to .env (interactive)

Examples:
  npx ts-node scripts/setup-env-wallet.ts generate
  npx ts-node scripts/setup-env-wallet.ts show
  npx ts-node scripts/setup-env-wallet.ts save
`)
}

async function main(): Promise<void> {
  const command = process.argv[2]

  switch (command) {
    case 'generate':
      await cmdGenerate()
      break
    case 'from-mnemonic':
      await cmdFromMnemonic()
      break
    case 'from-key':
      await cmdFromKey()
      break
    case 'show':
      await cmdShow()
      break
    case 'save':
      await cmdSave()
      break
    default:
      printUsage()
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
