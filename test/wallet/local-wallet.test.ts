// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSignTypedData = jest.fn(() => "0xabcdef1234567890");
const mockSign = jest.fn(async (data: any) => `signed_${JSON.stringify(data).slice(0, 20)}`);
const mockSendRawTransaction = jest.fn(async () => ({ result: true, txid: "mock_txid_123" }));
const mockTronWebInstance = {
  trx: { sign: mockSign, sendRawTransaction: mockSendRawTransaction, _signTypedData: mockSignTypedData },
  defaultAddress: { base58: "T_TEST_ADDR", hex: "41aabbcc" },
};
const mockFromPrivateKey = jest.fn(() => "T_LOCAL_ADDR_abc123");

jest.mock("tronweb", () => {
  return {
    TronWeb: Object.assign(
      jest.fn(() => mockTronWebInstance),
      { address: { fromPrivateKey: mockFromPrivateKey } },
    ),
  };
});

jest.mock("@scure/bip39", () => ({
  mnemonicToSeedSync: jest.fn(),
  validateMnemonic: jest.fn(),
}));
jest.mock("@scure/bip39/wordlists/english.js", () => ({ wordlist: [] }));
jest.mock("@scure/bip32", () => ({
  HDKey: { fromMasterSeed: jest.fn() },
}));

jest.mock("@bankofai/agent-wallet", () => ({
  WalletFactory: jest.fn(),
  SecureKVStore: class {},
  TronWallet: class {},
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { LocalWallet } from "../../src/wallet/local-wallet";

const TEST_KEY = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

function cleanEnv() {
  delete process.env.TRON_PRIVATE_KEY;
  delete process.env.TRON_MNEMONIC;
  delete process.env.TRON_ACCOUNT_INDEX;
  delete process.env.TRONGRID_API_KEY;
  delete process.env.TRON_GRID_API_KEY;
}

beforeEach(() => {
  cleanEnv();
  jest.clearAllMocks();
});
afterAll(cleanEnv);

describe("LocalWallet", () => {
  function createWallet(): LocalWallet {
    process.env.TRON_PRIVATE_KEY = TEST_KEY;
    return new LocalWallet();
  }

  describe("constructor", () => {
    it("reads private key from env and derives address", () => {
      const wallet = createWallet();
      expect(wallet.type).toBe("local");
      expect(mockFromPrivateKey).toHaveBeenCalledWith(TEST_KEY);
    });

    it("throws when no private key / mnemonic is configured", () => {
      expect(() => new LocalWallet()).toThrow(/Neither TRON_PRIVATE_KEY nor TRON_MNEMONIC/);
    });
  });

  describe("getAddress", () => {
    it("returns the derived address", async () => {
      const wallet = createWallet();
      const addr = await wallet.getAddress();
      expect(addr).toBe("T_LOCAL_ADDR_abc123");
    });
  });

  describe("getTronWeb", () => {
    it("returns a TronWeb instance for the given network", async () => {
      const wallet = createWallet();
      const tw = await wallet.getTronWeb("mainnet");
      expect(tw).toBe(mockTronWebInstance);
    });

    it("caches TronWeb instances per network", async () => {
      const wallet = createWallet();
      const tw1 = await wallet.getTronWeb("mainnet");
      const tw2 = await wallet.getTronWeb("mainnet");
      expect(tw1).toBe(tw2);
    });

    it("creates separate instances for different networks", async () => {
      const { TronWeb } = require("tronweb");
      const wallet = createWallet();
      await wallet.getTronWeb("mainnet");
      await wallet.getTronWeb("nile");
      // Constructor called once per network
      expect(TronWeb).toHaveBeenCalledTimes(2);
    });

    it("defaults to mainnet", async () => {
      const wallet = createWallet();
      const tw = await wallet.getTronWeb();
      expect(tw).toBe(mockTronWebInstance);
    });

    it("passes API key header when TRONGRID_API_KEY is set", async () => {
      process.env.TRONGRID_API_KEY = "my-api-key";
      const { TronWeb } = require("tronweb");
      const wallet = createWallet();
      await wallet.getTronWeb("mainnet");

      const callArgs = TronWeb.mock.calls[TronWeb.mock.calls.length - 1][0];
      expect(callArgs.headers).toEqual({ "TRON-PRO-API-KEY": "my-api-key" });
    });
  });

  describe("signAndBroadcast", () => {
    it("signs and broadcasts a transaction, returning result + txid", async () => {
      const wallet = createWallet();
      const unsignedTx = { txID: "abc", raw_data: {} };

      const result = await wallet.signAndBroadcast(unsignedTx as any);

      expect(mockSign).toHaveBeenCalledWith(unsignedTx);
      expect(mockSendRawTransaction).toHaveBeenCalled();
      expect(result).toEqual({ result: true, txid: "mock_txid_123" });
    });

    it("extracts .transaction if present (triggerSmartContract format)", async () => {
      const wallet = createWallet();
      const innerTx = { txID: "inner", raw_data: {} };
      const wrapper = { transaction: innerTx, result: { result: true } };

      await wallet.signAndBroadcast(wrapper as any);

      expect(mockSign).toHaveBeenCalledWith(innerTx);
    });

    it("uses the specified network for TronWeb", async () => {
      const { TronWeb } = require("tronweb");
      const wallet = createWallet();

      await wallet.signAndBroadcast({ txID: "x" } as any, "nile");

      // Should have created a TronWeb for nile
      const configs = TronWeb.mock.calls.map((c: any) => c[0].fullHost);
      expect(configs).toContain("https://nile.trongrid.io");
    });
  });

  describe("signMessage", () => {
    it("signs a message string via tronWeb.trx.sign", async () => {
      const wallet = createWallet();
      const sig = await wallet.signMessage("hello world");

      expect(mockSign).toHaveBeenCalledWith("hello world");
      expect(sig).toMatch(/^signed_/);
    });
  });

  describe("signTypedData", () => {
    const domain = { name: "Permit2", chainId: 728126428, verifyingContract: "0xCcCC" };
    const types = {
      PermitDetails: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint160" },
      ],
      PermitSingle: [
        { name: "details", type: "PermitDetails" },
        { name: "spender", type: "address" },
      ],
    };
    const message = { details: { token: "0xabc", amount: "1000" }, spender: "0xdef" };

    it("delegates to tronWeb.trx._signTypedData", async () => {
      const wallet = createWallet();
      await wallet.signTypedData("PermitSingle", domain, types, message);

      expect(mockSignTypedData).toHaveBeenCalledWith(domain, types, message);
    });

    it("strips 0x prefix from TronWeb signature", async () => {
      mockSignTypedData.mockReturnValueOnce("0xdeadbeef");
      const wallet = createWallet();
      const sig = await wallet.signTypedData("PermitSingle", domain, types, message);

      expect(sig).toBe("deadbeef");
    });

    it("returns raw hex unchanged if no 0x prefix", async () => {
      mockSignTypedData.mockReturnValueOnce("deadbeef");
      const wallet = createWallet();
      const sig = await wallet.signTypedData("PermitSingle", domain, types, message);

      expect(sig).toBe("deadbeef");
    });
  });
});
