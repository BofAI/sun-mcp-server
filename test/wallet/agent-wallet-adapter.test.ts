// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetOwnerAddress = jest.fn<Promise<string>, any[]>(async () => "T_AGENT_ADDR_xyz");
const mockBuildSignBroadcast = jest.fn<Promise<string>, any[]>(async () => "agent_txid_456");
const mockSignMessageWithWallet = jest.fn<Promise<string>, any[]>(async () => "agent_sig_789");
const mockSignTypedDataWithWallet = jest.fn<Promise<string>, any[]>(async () => "deadbeef");

jest.mock("../../src/wallet/agent-wallet", () => ({
  getOwnerAddress: () => mockGetOwnerAddress(),
  signTransaction: jest.fn(),
  buildSignBroadcast: (tx: any, network: any) => mockBuildSignBroadcast(tx, network),
  signMessageWithWallet: (msg: any) => mockSignMessageWithWallet(msg),
  signTypedDataWithWallet: (pt: any, d: any, t: any, m: any) => mockSignTypedDataWithWallet(pt, d, t, m),
  isAgentWalletConfigured: jest.fn(() => true),
}));

const mockReadonlyTronWeb = {
  address: {
    toHex: jest.fn((addr: string) => `41_hex_${addr}`),
    fromHex: jest.fn((hex: string) => `base58_${hex}`),
  },
  defaultAddress: {} as any,
  transactionBuilder: {},
  trx: {},
};

jest.mock("@bankofai/sun-kit", () => ({
  createReadonlyTronWeb: jest.fn(async () => mockReadonlyTronWeb),
  getNetworkConfig: jest.fn(() => ({
    fullNode: "https://api.trongrid.io",
    solidityNode: "https://api.trongrid.io",
    eventServer: "https://api.trongrid.io",
  })),
}));

jest.mock("tronweb", () => ({
  TronWeb: function () {
    return {};
  },
}));

jest.mock("@scure/bip39", () => ({ mnemonicToSeedSync: jest.fn(), validateMnemonic: jest.fn() }));
jest.mock("@scure/bip39/wordlists/english.js", () => ({ wordlist: [] }));
jest.mock("@scure/bip32", () => ({ HDKey: { fromMasterSeed: jest.fn() } }));

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

import { AgentWalletAdapter } from "../../src/wallet/agent-wallet-adapter";

beforeEach(() => {
  jest.clearAllMocks();
  // Reset defaultAddress before each test
  mockReadonlyTronWeb.defaultAddress = {};
});

describe("AgentWalletAdapter", () => {
  describe("type", () => {
    it("is 'agent-wallet'", () => {
      const adapter = new AgentWalletAdapter();
      expect(adapter.type).toBe("agent-wallet");
    });
  });

  describe("getAddress", () => {
    it("delegates to agent-wallet getOwnerAddress", async () => {
      const adapter = new AgentWalletAdapter();
      const addr = await adapter.getAddress();

      expect(addr).toBe("T_AGENT_ADDR_xyz");
      expect(mockGetOwnerAddress).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTronWeb", () => {
    it("returns a readonly TronWeb with defaultAddress set to owner", async () => {
      const adapter = new AgentWalletAdapter();
      const tw = await adapter.getTronWeb("mainnet");

      expect(tw).toBe(mockReadonlyTronWeb);
      // defaultAddress should be set
      expect(mockReadonlyTronWeb.defaultAddress.hex).toBeTruthy();
      expect(mockReadonlyTronWeb.defaultAddress.base58).toBeTruthy();
    });

    it("calls createReadonlyTronWeb with the requested network", async () => {
      const { createReadonlyTronWeb } = require("@bankofai/sun-kit");
      const adapter = new AgentWalletAdapter();

      await adapter.getTronWeb("nile");

      expect(createReadonlyTronWeb).toHaveBeenCalledWith("nile");
    });

    it("defaults to mainnet", async () => {
      const { createReadonlyTronWeb } = require("@bankofai/sun-kit");
      const adapter = new AgentWalletAdapter();

      await adapter.getTronWeb();

      expect(createReadonlyTronWeb).toHaveBeenCalledWith("mainnet");
    });
  });

  describe("signAndBroadcast", () => {
    it("delegates to buildSignBroadcast and returns {result, txid}", async () => {
      const adapter = new AgentWalletAdapter();
      const unsignedTx = { txID: "abc", raw_data: {} };

      const result = await adapter.signAndBroadcast(unsignedTx as any, "mainnet");

      expect(mockBuildSignBroadcast).toHaveBeenCalledWith(unsignedTx, "mainnet");
      expect(result).toEqual({ result: true, txid: "agent_txid_456" });
    });

    it("extracts .transaction if present", async () => {
      const adapter = new AgentWalletAdapter();
      const innerTx = { txID: "inner" };
      const wrapper = { transaction: innerTx, result: { result: true } };

      await adapter.signAndBroadcast(wrapper as any, "nile");

      expect(mockBuildSignBroadcast).toHaveBeenCalledWith(innerTx, "nile");
    });

    it("defaults network to mainnet", async () => {
      const adapter = new AgentWalletAdapter();
      await adapter.signAndBroadcast({ txID: "x" } as any);

      expect(mockBuildSignBroadcast).toHaveBeenCalledWith({ txID: "x" }, "mainnet");
    });
  });

  describe("signMessage", () => {
    it("delegates to signMessageWithWallet", async () => {
      const adapter = new AgentWalletAdapter();
      const sig = await adapter.signMessage("hello");

      expect(mockSignMessageWithWallet).toHaveBeenCalledWith("hello");
      expect(sig).toBe("agent_sig_789");
    });
  });

  describe("signTypedData", () => {
    const domain = { name: "Permit2", chainId: 728126428 };
    const types = { PermitSingle: [{ name: "spender", type: "address" }] };
    const message = { spender: "0xabc" };

    it("delegates to signTypedDataWithWallet", async () => {
      const adapter = new AgentWalletAdapter();
      const sig = await adapter.signTypedData("PermitSingle", domain, types, message);

      expect(mockSignTypedDataWithWallet).toHaveBeenCalledWith("PermitSingle", domain, types, message);
      expect(sig).toBe("deadbeef");
    });
  });
});
