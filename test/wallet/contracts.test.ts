// ---------------------------------------------------------------------------
// Test that the refactored contracts.ts properly delegates to the Wallet
// interface instead of branching on wallet.type.
// ---------------------------------------------------------------------------

// --- Mock Wallet ---
const mockWalletGetAddress = jest.fn(async () => "T_MOCK_OWNER");
const mockWalletGetTronWeb = jest.fn();
const mockWalletSignAndBroadcast = jest.fn(async () => ({ result: true, txid: "tx_bcast_001" }));

const mockWallet = {
  type: "local" as const,
  getAddress: mockWalletGetAddress,
  getTronWeb: mockWalletGetTronWeb,
  signAndBroadcast: mockWalletSignAndBroadcast,
  signMessage: jest.fn(),
};

jest.mock("../../src/wallet", () => ({
  getWallet: () => mockWallet,
  getWalletAddress: async () => mockWalletGetAddress(),
  isWalletConfigured: () => true,
  isLocalWalletConfigured: () => false,
  getConfiguredLocalWallet: jest.fn(),
  initWallet: jest.fn(),
}));

// --- Mock TronWeb instance returned by wallet.getTronWeb ---
const mockTriggerSmartContract = jest.fn(async () => ({
  transaction: { txID: "unsigned_001", raw_data: {} },
}));
const mockTriggerConfirmedConstantContract = jest.fn(async () => ({
  constant_result: ["0000000000000000000000000000000000000000000000000000000000000064"], // 100
}));
const mockContractAt = jest.fn(async () => ({
  abi: [
    {
      type: "function",
      name: "approve",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    },
  ],
  methods: {},
}));

const mockTronWeb: any = {
  defaultAddress: { base58: "T_MOCK_ISSUER", hex: "41_mock_hex" },
  address: {
    toHex: jest.fn((addr: string) => `41_hex_${addr}`),
    fromHex: jest.fn((hex: string) => `base58_${hex}`),
  },
  transactionBuilder: {
    triggerSmartContract: mockTriggerSmartContract,
    triggerConfirmedConstantContract: mockTriggerConfirmedConstantContract,
  },
  contract: jest.fn((...args: any[]) => {
    if (args.length >= 2) {
      // contract(abi, address) form
      return {
        abi: args[0],
        methods: {},
      };
    }
    // contract() form — return object with .at()
    return { at: mockContractAt };
  }),
};

jest.mock("tronweb", () => {
  return {
    TronWeb: Object.assign(
      function TronWebMock() {
        return mockTronWeb;
      },
      { address: { fromPrivateKey: jest.fn() } },
    ),
  };
});

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

import {
  signAndBroadcastContractTx,
  sendContractTx,
  ensureTokenAllowance,
  readConstantContractSolidity,
} from "../../src/sunswap/contracts";

beforeEach(() => {
  jest.clearAllMocks();
  mockWalletGetTronWeb.mockResolvedValue(mockTronWeb);
});

describe("signAndBroadcastContractTx", () => {
  it("delegates to wallet.signAndBroadcast", async () => {
    const unsignedTx = { transaction: { txID: "abc" } };

    const result = await signAndBroadcastContractTx(unsignedTx, "mainnet");

    expect(mockWalletSignAndBroadcast).toHaveBeenCalledWith(unsignedTx, "mainnet");
    expect(result).toEqual({ result: true, txid: "tx_bcast_001" });
  });

  it("defaults to mainnet", async () => {
    await signAndBroadcastContractTx({ txID: "x" });

    expect(mockWalletSignAndBroadcast).toHaveBeenCalledWith({ txID: "x" }, "mainnet");
  });
});

describe("sendContractTx", () => {
  it("gets TronWeb from wallet, builds tx, then signs and broadcasts", async () => {
    const params = {
      address: "TContractAddr",
      functionName: "approve",
      args: ["TSpender", "1000"],
      abi: [
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
      ],
      network: "nile",
    };

    await sendContractTx(params);

    // 1) Wallet.getTronWeb called with the right network
    expect(mockWalletGetTronWeb).toHaveBeenCalledWith("nile");
    // 2) triggerSmartContract called to build the unsigned tx
    expect(mockTriggerSmartContract).toHaveBeenCalledWith(
      "TContractAddr",
      "approve(address,uint256)",
      expect.any(Object),
      expect.arrayContaining([
        { type: "address", value: "TSpender" },
        { type: "uint256", value: "1000" },
      ]),
      "T_MOCK_ISSUER", // issuerAddress from defaultAddress.base58
    );
    // 3) Wallet.signAndBroadcast called
    expect(mockWalletSignAndBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: expect.any(Object) }),
      "nile",
    );
  });

  it("defaults network to mainnet", async () => {
    const params = {
      address: "TContractAddr",
      functionName: "approve",
      args: ["TSpender", "1000"],
      abi: [
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
      ],
    };

    await sendContractTx(params);

    expect(mockWalletGetTronWeb).toHaveBeenCalledWith("mainnet");
    expect(mockWalletSignAndBroadcast).toHaveBeenCalledWith(expect.anything(), "mainnet");
  });

  it("sets callValue when value is provided", async () => {
    const params = {
      address: "TContractAddr",
      functionName: "approve",
      args: ["TSpender", "1000"],
      value: "5000000",
      abi: [
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
      ],
    };

    await sendContractTx(params);

    expect(mockTriggerSmartContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ callValue: "5000000" }),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe("readConstantContractSolidity", () => {
  it("returns constant_result from solidity node call", async () => {
    const result = await readConstantContractSolidity(
      mockTronWeb,
      "TTokenAddr",
      "allowance(address,address)",
      [
        { type: "address", value: "TOwner" },
        { type: "address", value: "TSpender" },
      ],
      "41_hex_owner",
    );

    expect(mockTriggerConfirmedConstantContract).toHaveBeenCalledWith(
      "TTokenAddr",
      "allowance(address,address)",
      { callValue: 0, feeLimit: 100_000_000 },
      [
        { type: "address", value: "TOwner" },
        { type: "address", value: "TSpender" },
      ],
      "41_hex_owner",
    );
    expect(result).toEqual([
      "0000000000000000000000000000000000000000000000000000000000000064",
    ]);
  });

  it("throws when constant_result is missing", async () => {
    mockTriggerConfirmedConstantContract.mockResolvedValueOnce({} as any);

    await expect(
      readConstantContractSolidity(
        mockTronWeb,
        "TTokenAddr",
        "allowance(address,address)",
        [],
        "41_hex",
      ),
    ).rejects.toThrow(/no constant_result/);
  });
});

describe("ensureTokenAllowance", () => {
  it("skips approve when current allowance is sufficient", async () => {
    // constant_result returns 100 (0x64)
    mockTriggerConfirmedConstantContract.mockResolvedValueOnce({
      constant_result: ["0000000000000000000000000000000000000000000000000000000000000064"],
    });

    await ensureTokenAllowance({
      network: "mainnet",
      tokenAddress: "TToken",
      spender: "TSpender",
      requiredAmount: "50", // 50 < 100 → sufficient
    });

    // signAndBroadcast should NOT be called (no approve needed)
    expect(mockWalletSignAndBroadcast).not.toHaveBeenCalled();
  });

  it("sends approve tx when current allowance is insufficient", async () => {
    // constant_result returns 10 (0x0a)
    mockTriggerConfirmedConstantContract.mockResolvedValueOnce({
      constant_result: ["000000000000000000000000000000000000000000000000000000000000000a"],
    });

    await ensureTokenAllowance({
      network: "mainnet",
      tokenAddress: "TToken",
      spender: "TSpender",
      requiredAmount: "1000", // 1000 > 10 → need approve
    });

    // Should have called signAndBroadcast for the approve
    expect(mockWalletSignAndBroadcast).toHaveBeenCalled();
  });

  it("skips approve when requiredAmount is 0", async () => {
    await ensureTokenAllowance({
      network: "mainnet",
      tokenAddress: "TToken",
      spender: "TSpender",
      requiredAmount: "0",
    });

    // Neither read nor write should occur for zero amount
    expect(mockWalletSignAndBroadcast).not.toHaveBeenCalled();
  });

  it("uses wallet.getAddress for the owner (no branching on wallet.type)", async () => {
    mockTriggerConfirmedConstantContract.mockResolvedValueOnce({
      constant_result: ["0000000000000000000000000000000000000000000000000000000000000064"],
    });

    await ensureTokenAllowance({
      tokenAddress: "TToken",
      spender: "TSpender",
      requiredAmount: "10",
    });

    expect(mockWalletGetAddress).toHaveBeenCalled();
  });
});
