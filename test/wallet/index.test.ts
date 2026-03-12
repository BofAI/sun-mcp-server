// ---------------------------------------------------------------------------
// Common mocks for ESM-only dependencies
// ---------------------------------------------------------------------------
const mockFromPrivateKey = jest.fn((key: string) => `T_ADDR_${key.slice(0, 6)}`);

jest.mock("tronweb", () => {
  return {
    TronWeb: Object.assign(
      function TronWebMock() {
        return {};
      },
      { address: { fromPrivateKey: mockFromPrivateKey } },
    ),
  };
});

jest.mock("@scure/bip39", () => ({
  mnemonicToSeedSync: jest.fn(() => Buffer.alloc(64, 0xab)),
  validateMnemonic: jest.fn(() => true),
}));

jest.mock("@scure/bip39/wordlists/english.js", () => ({ wordlist: [] }));

const mockDerive = jest.fn(() => ({
  privateKey: Buffer.alloc(32, 0xcd),
}));
jest.mock("@scure/bip32", () => ({
  HDKey: {
    fromMasterSeed: jest.fn(() => ({ derive: mockDerive })),
  },
}));

jest.mock("@bankofai/agent-wallet", () => ({
  WalletFactory: jest.fn(() => ({})),
  SecureKVStore: class {},
  TronWallet: class {},
  loadConfig: jest.fn(() => ({ wallets: {} })),
  saveConfig: jest.fn(),
}));

jest.mock("@bankofai/sun-kit", () => ({
  createReadonlyTronWeb: jest.fn().mockResolvedValue({}),
  getNetworkConfig: jest.fn(() => ({
    fullNode: "https://api.trongrid.io",
    solidityNode: "https://api.trongrid.io",
    eventServer: "https://api.trongrid.io",
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import {
  initWallet,
  getWallet,
  getWalletAddress,
  isWalletConfigured,
  isLocalWalletConfigured,
  getConfiguredLocalWallet,
} from "../../src/wallet";

// We need to reset the module-level singleton between tests.
// initWallet() sets a module-scoped `_wallet`; to truly isolate tests we
// re-import via `jest.isolateModules` where needed, but for most tests
// calling `initWallet()` with different env vars is sufficient because
// the singleton is overwritten each time.

function cleanEnv() {
  delete process.env.TRON_PRIVATE_KEY;
  delete process.env.TRON_MNEMONIC;
  delete process.env.TRON_ACCOUNT_INDEX;
  delete process.env.AGENT_WALLET_PASSWORD;
  delete process.env.AGENT_WALLET_DIR;
}

beforeEach(cleanEnv);
afterAll(cleanEnv);

// ===== isLocalWalletConfigured =====

describe("isLocalWalletConfigured", () => {
  it("returns false when neither key nor mnemonic is set", () => {
    expect(isLocalWalletConfigured()).toBe(false);
  });

  it("returns true when TRON_PRIVATE_KEY is set", () => {
    process.env.TRON_PRIVATE_KEY = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    expect(isLocalWalletConfigured()).toBe(true);
  });

  it("returns true when TRON_MNEMONIC is set", () => {
    process.env.TRON_MNEMONIC = "test test test test test test test test test test test junk";
    expect(isLocalWalletConfigured()).toBe(true);
  });
});

// ===== getConfiguredLocalWallet =====

describe("getConfiguredLocalWallet", () => {
  it("returns address from private key (strips 0x prefix)", () => {
    const rawKey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    process.env.TRON_PRIVATE_KEY = `0x${rawKey}`;

    const wallet = getConfiguredLocalWallet();
    expect(wallet.privateKey).toBe(rawKey);
    expect(mockFromPrivateKey).toHaveBeenCalledWith(rawKey);
    expect(wallet.address).toBe(`T_ADDR_${rawKey.slice(0, 6)}`);
  });

  it("returns address from private key without 0x prefix", () => {
    const rawKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    process.env.TRON_PRIVATE_KEY = rawKey;

    const wallet = getConfiguredLocalWallet();
    expect(wallet.privateKey).toBe(rawKey);
  });

  it("derives key from mnemonic with default account index 0", () => {
    process.env.TRON_MNEMONIC = "test test test test test test test test test test test junk";

    const wallet = getConfiguredLocalWallet();
    expect(mockDerive).toHaveBeenCalledWith("m/44'/195'/0'/0/0");
    expect(wallet.privateKey).toBeTruthy();
    expect(wallet.address).toBeTruthy();
  });

  it("derives key from mnemonic with custom account index", () => {
    process.env.TRON_MNEMONIC = "test test test test test test test test test test test junk";
    process.env.TRON_ACCOUNT_INDEX = "3";

    getConfiguredLocalWallet();
    expect(mockDerive).toHaveBeenCalledWith("m/44'/195'/0'/0/3");
  });

  it("throws on invalid TRON_ACCOUNT_INDEX", () => {
    process.env.TRON_MNEMONIC = "test test test test test test test test test test test junk";
    process.env.TRON_ACCOUNT_INDEX = "-1";

    expect(() => getConfiguredLocalWallet()).toThrow(/Invalid TRON_ACCOUNT_INDEX/);
  });

  it("throws on non-integer TRON_ACCOUNT_INDEX", () => {
    process.env.TRON_MNEMONIC = "test test test test test test test test test test test junk";
    process.env.TRON_ACCOUNT_INDEX = "abc";

    expect(() => getConfiguredLocalWallet()).toThrow(/Invalid TRON_ACCOUNT_INDEX/);
  });

  it("throws when neither key nor mnemonic is set", () => {
    expect(() => getConfiguredLocalWallet()).toThrow(/Neither TRON_PRIVATE_KEY nor TRON_MNEMONIC/);
  });

  it("prioritises TRON_PRIVATE_KEY over TRON_MNEMONIC", () => {
    const rawKey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    process.env.TRON_PRIVATE_KEY = rawKey;
    process.env.TRON_MNEMONIC = "test test test test test test test test test test test junk";

    const wallet = getConfiguredLocalWallet();
    // Should use private key path, not mnemonic
    expect(wallet.privateKey).toBe(rawKey);
  });
});

// ===== initWallet / getWallet / isWalletConfigured =====

describe("initWallet", () => {
  it("initialises with LocalWallet when TRON_PRIVATE_KEY is set", async () => {
    process.env.TRON_PRIVATE_KEY = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    await initWallet();

    expect(isWalletConfigured()).toBe(true);
    const wallet = getWallet();
    expect(wallet.type).toBe("local");
  });

  it("initialises with AgentWalletAdapter when AGENT_WALLET_PASSWORD is set", async () => {
    process.env.AGENT_WALLET_PASSWORD = "test-password";

    await initWallet();

    expect(isWalletConfigured()).toBe(true);
    const wallet = getWallet();
    expect(wallet.type).toBe("agent-wallet");
  });

  it("agent-wallet takes priority over local wallet", async () => {
    process.env.AGENT_WALLET_PASSWORD = "test-password";
    process.env.TRON_PRIVATE_KEY = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    await initWallet();

    const wallet = getWallet();
    expect(wallet.type).toBe("agent-wallet");
  });

  it("sets read-only mode when no wallet env is set", async () => {
    await initWallet();

    expect(isWalletConfigured()).toBe(false);
  });
});

describe("getWallet", () => {
  it("throws when no wallet is configured (read-only mode)", async () => {
    await initWallet(); // no env vars → read-only

    expect(() => getWallet()).toThrow(/No wallet configured/);
  });
});

describe("getWalletAddress", () => {
  it("returns the address from the active wallet", async () => {
    process.env.TRON_PRIVATE_KEY = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    await initWallet();

    const address = await getWalletAddress();
    expect(address).toMatch(/^T_ADDR_/);
  });
});
