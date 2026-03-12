// Mock ESM-only dependencies used by SUNSWAP wallet/contracts so that this
// test can run in Jest's CommonJS environment without loading their real code.
jest.mock("tronweb", () => ({
  TronWeb: function TronWebMock() {
    return {};
  },
}));

jest.mock("@scure/bip39", () => ({
  mnemonicToSeedSync: jest.fn(),
  generateMnemonic: jest.fn(),
  validateMnemonic: jest.fn(),
}));

jest.mock("@scure/bip39/wordlists/english.js", () => ({
  wordlist: [],
}));

jest.mock("@scure/bip32", () => ({
  HDKey: class HDKeyMock {},
}));

jest.mock("@bankofai/agent-wallet", () => ({
  resolveWalletProvider: jest.fn(() => ({})),
  SecureKVStore: class SecureKVStoreMock {},
  TronWallet: class TronWalletMock {},
  loadConfig: jest.fn(() => ({ wallets: {} })),
  saveConfig: jest.fn(),
}), { virtual: true });

jest.mock("@sun-protocol/universal-router-sdk", () => {
  class TradePlannerMock {
    commands: string;
    inputs: any[];
    constructor() {
      this.commands = "0x";
      this.inputs = [];
    }
    encode() {}
  }
  return {
    TradePlanner: TradePlannerMock,
    parseRouteAPIResponse: jest.fn(() => ({})),
  };
});

jest.mock("@sun-protocol/permit2-sdk", () => {
  class AllowanceTransferMock {
    constructor() {}
    async generatePermitSignature() {
      return {};
    }
  }
  return { AllowanceTransfer: AllowanceTransferMock };
});

import { registerSunswapTools } from "../../src/tools/sunswap";

describe("sunswap tool registration", () => {
  it("registers expected tool names without duplicates", () => {
    const names: string[] = [];

    const registerTool: any = (name: string, _definition: any, _handler: any) => {
      names.push(name);
    };

    const mockDeps = { api: {} as any, kit: {} as any };
    registerSunswapTools(registerTool, mockDeps);

    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    const expected = [
      "sunswap_get_wallet_address",
      "sunswap_v3_collect",
      "sunswap_get_balances",
      "sunswap_quote_exact_input",
      "sunswap_read_contract",
      "sunswap_swap_exact_input",
      "sunswap_get_token_price",
      "sunswap_v2_add_liquidity",
      "sunswap_v2_remove_liquidity",
      "sunswap_v3_mint_position",
      "sunswap_v3_increase_liquidity",
      "sunswap_v3_decrease_liquidity",
      "sunswap_send_contract",
      "sunswap_v4_mint_position",
      "sunswap_v4_increase_liquidity",
      "sunswap_v4_decrease_liquidity",
      "sunswap_v4_collect",
      "sunswap_swap",
    ];

    for (const name of expected) {
      expect(names).toContain(name);
    }
  });
});
