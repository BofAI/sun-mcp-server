// Mock ESM-only dependencies used by SUNSWAP wallet/contracts so that this
// test can run in Jest's CommonJS environment without loading their code.
jest.mock("tronweb", () => {
  return {
    TronWeb: function TronWebMock() {
      return {};
    },
  };
}, { virtual: true });

jest.mock("@scure/bip39", () => {
  return {
    mnemonicToSeedSync: jest.fn(),
    generateMnemonic: jest.fn(),
    validateMnemonic: jest.fn(),
  };
}, { virtual: true });

jest.mock("@scure/bip39/wordlists/english.js", () => {
  return {
    wordlist: [],
  };
}, { virtual: true });

jest.mock("@scure/bip32", () => {
  return {
    HDKey: class HDKeyMock {},
  };
}, { virtual: true });

import { registerSunswapTools } from "../../src/tools/sunswap";

describe("sunswap tool registration", () => {
  it("registers expected tool names without duplicates", () => {
    const names: string[] = [];

    const registerTool: any = (name: string, _definition: any, _handler: any) => {
      names.push(name);
    };

    registerSunswapTools(registerTool);

    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    const expected = [
      "sunswap_get_wallet_address",
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
    ];

    for (const name of expected) {
      expect(names).toContain(name);
    }
  });
});

