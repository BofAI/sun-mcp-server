/**
 * Tests for sunswap tool *handlers* — verifies each registered tool handler
 * delegates to the correct SunKit / SunAPI method and returns the expected
 * MCP response shape (including error paths).
 */

jest.mock("tronweb", () => ({
  TronWeb: function TronWebMock() { return {} },
}));

jest.mock("@scure/bip39", () => ({
  mnemonicToSeedSync: jest.fn(),
  generateMnemonic: jest.fn(),
  validateMnemonic: jest.fn(),
}));

jest.mock("@scure/bip39/wordlists/english.js", () => ({ wordlist: [] }));

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

jest.mock("@sun-protocol/universal-router-sdk", () => ({
  TradePlanner: class { commands = "0x"; inputs: any[] = []; encode() {} },
  parseRouteAPIResponse: jest.fn(() => ({})),
}));

jest.mock("@sun-protocol/permit2-sdk", () => ({
  AllowanceTransfer: class { async generatePermitSignature() { return {} } },
}));

import { registerSunswapTools, type SunswapToolsDeps } from "../../src/tools/sunswap";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolHandler = (args: any) => Promise<any>;

/** Capture all handlers registered by registerSunswapTools. */
function collectHandlers(deps: SunswapToolsDeps): Record<string, ToolHandler> {
  const handlers: Record<string, ToolHandler> = {};
  const registerTool: any = (name: string, _def: any, handler: ToolHandler) => {
    handlers[name] = handler;
  };
  registerSunswapTools(registerTool, deps);
  return handlers;
}

function textOf(result: any): string {
  return result.content[0].text;
}

function jsonOf(result: any): any {
  return JSON.parse(textOf(result));
}

// ---------------------------------------------------------------------------
// Mock SunKit / SunAPI factories
// ---------------------------------------------------------------------------

function mockKit(overrides: Record<string, jest.Mock> = {}) {
  return {
    getBalances: jest.fn().mockResolvedValue([
      { address: "TAddr1", type: "TRX", balance: "100000000" },
    ]),
    quoteExactInput: jest.fn().mockResolvedValue("99000000"),
    readContract: jest.fn().mockResolvedValue("contract-return-value"),
    swapExactInput: jest.fn().mockResolvedValue({ txid: "tx-swap-input", result: true }),
    swap: jest.fn().mockResolvedValue({
      txid: "tx-swap",
      route: { amountIn: "1000000", amountOut: "990000", symbols: ["USDT", "TRX"], poolVersions: ["V3"], impact: "0.01" },
    }),
    sendContractTx: jest.fn().mockResolvedValue({ txid: "tx-send", result: true }),
    addLiquidityV2: jest.fn().mockResolvedValue({ txid: "tx-v2-add", result: true }),
    removeLiquidityV2: jest.fn().mockResolvedValue({ txid: "tx-v2-rm", result: true }),
    mintPositionV3: jest.fn().mockResolvedValue({ txid: "tx-v3-mint", tokenId: "12345" }),
    increaseLiquidityV3: jest.fn().mockResolvedValue({ txid: "tx-v3-inc" }),
    decreaseLiquidityV3: jest.fn().mockResolvedValue({ txid: "tx-v3-dec" }),
    collectPositionV3: jest.fn().mockResolvedValue({
      estimatedFees: { amount0: "100", amount1: "200" },
      txResult: { txid: "tx-v3-collect" },
    }),
    mintPositionV4: jest.fn().mockResolvedValue({ txResult: { txid: "tx-v4-mint" }, tokenId: "99" }),
    increaseLiquidityV4: jest.fn().mockResolvedValue({ txResult: { txid: "tx-v4-inc" } }),
    decreaseLiquidityV4: jest.fn().mockResolvedValue({ txResult: { txid: "tx-v4-dec" } }),
    collectPositionV4: jest.fn().mockResolvedValue({ txResult: { txid: "tx-v4-collect" } }),
    ...overrides,
  } as any;
}

function mockApi(overrides: Record<string, jest.Mock> = {}) {
  return {
    getPrice: jest.fn().mockResolvedValue({
      code: 0, msg: "success", data: { SUN: "0.025", TRX: "0.13" },
    }),
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Wallet mocks — we need to control the wallet module for some handlers
// ---------------------------------------------------------------------------

const mockGetWalletAddress = jest.fn().mockResolvedValue("TMockWalletAddress123");

jest.mock("../../src/wallet", () => ({
  getWalletAddress: (...args: any[]) => mockGetWalletAddress(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sunswap tool handlers", () => {
  let kit: ReturnType<typeof mockKit>;
  let api: ReturnType<typeof mockApi>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    kit = mockKit();
    api = mockApi();
    handlers = collectHandlers({ api, kit });
  });

  // =========================================================================
  // READ-ONLY tools
  // =========================================================================

  describe("sunswap_get_wallet_address", () => {
    it("returns the wallet address in expected shape", async () => {
      const result = await handlers.sunswap_get_wallet_address({ network: "nile" });
      const data = jsonOf(result);

      expect(data.address).toBe("TMockWalletAddress123");
      expect(data.network).toBe("nile");
      expect(mockGetWalletAddress).toHaveBeenCalled();
    });

    it("defaults network to mainnet when omitted", async () => {
      const result = await handlers.sunswap_get_wallet_address({});
      expect(jsonOf(result).network).toBe("mainnet");
    });
  });

  describe("sunswap_get_balances", () => {
    const params = {
      network: "mainnet",
      ownerAddress: "TOwner1",
      tokens: [{ type: "TRX" as const }],
    };

    it("returns balances from kit.getBalances", async () => {
      const result = await handlers.sunswap_get_balances(params);
      const data = jsonOf(result);

      expect(data).toEqual([{ address: "TAddr1", type: "TRX", balance: "100000000" }]);
      expect(kit.getBalances).toHaveBeenCalledWith(
        expect.objectContaining({ network: "mainnet", ownerAddress: "TOwner1" }),
      );
    });

    it("returns isError on failure", async () => {
      kit.getBalances.mockRejectedValueOnce(new Error("rpc timeout"));
      const result = await handlers.sunswap_get_balances(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("rpc timeout");
    });
  });

  describe("sunswap_quote_exact_input", () => {
    const params = {
      routerAddress: "TRouter1",
      args: ["0x01", "1000000"],
    };

    it("returns quote result", async () => {
      const result = await handlers.sunswap_quote_exact_input(params);
      expect(jsonOf(result).result).toBe("99000000");
      expect(kit.quoteExactInput).toHaveBeenCalledWith(
        expect.objectContaining({ routerAddress: "TRouter1", args: params.args }),
      );
    });

    it("returns isError on failure", async () => {
      kit.quoteExactInput.mockRejectedValueOnce(new Error("out of energy"));
      const result = await handlers.sunswap_quote_exact_input(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("out of energy");
    });
  });

  describe("sunswap_read_contract", () => {
    const params = {
      address: "TContract1",
      functionName: "balanceOf",
      args: ["TOwner1"],
    };

    it("returns contract read result", async () => {
      const result = await handlers.sunswap_read_contract(params);
      expect(jsonOf(result).result).toBe("contract-return-value");
      expect(kit.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ address: "TContract1", functionName: "balanceOf", args: ["TOwner1"] }),
        "mainnet",
      );
    });

    it("uses provided network", async () => {
      await handlers.sunswap_read_contract({ ...params, network: "nile" });
      expect(kit.readContract).toHaveBeenCalledWith(expect.anything(), "nile");
    });

    it("returns isError on failure", async () => {
      kit.readContract.mockRejectedValueOnce(new Error("contract not found"));
      const result = await handlers.sunswap_read_contract(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("contract not found");
    });
  });

  describe("sunswap_get_token_price", () => {
    it("returns prices from api.getPrice", async () => {
      const result = await handlers.sunswap_get_token_price({ symbol: "SUN,TRX" });
      const data = jsonOf(result);

      expect(data.code).toBe(0);
      expect(data.data.SUN).toBe("0.025");
      expect(api.getPrice).toHaveBeenCalledWith({ tokenAddress: undefined, symbol: "SUN,TRX" });
    });

    it("passes tokenAddress", async () => {
      await handlers.sunswap_get_token_price({ tokenAddress: "TToken1" });
      expect(api.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({ tokenAddress: "TToken1" }),
      );
    });

    it("returns isError on failure", async () => {
      api.getPrice.mockRejectedValueOnce(new Error("api down"));
      const result = await handlers.sunswap_get_token_price({ symbol: "SUN" });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("api down");
    });
  });

  // =========================================================================
  // WRITE tools — success + error paths
  // =========================================================================

  describe("sunswap_swap_exact_input", () => {
    const params = {
      routerAddress: "TRouter1",
      args: ["0x01", "1000000"],
    };

    it("returns tx result from kit.swapExactInput", async () => {
      const result = await handlers.sunswap_swap_exact_input(params);
      expect(jsonOf(result).txid).toBe("tx-swap-input");
      expect(kit.swapExactInput).toHaveBeenCalledWith(
        expect.objectContaining({ routerAddress: "TRouter1" }),
      );
    });

    it("returns isError on failure", async () => {
      kit.swapExactInput.mockRejectedValueOnce(new Error("insufficient balance"));
      const result = await handlers.sunswap_swap_exact_input(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("insufficient balance");
    });
  });

  describe("sunswap_swap", () => {
    const params = {
      tokenIn: "TTokenIn",
      tokenOut: "TTokenOut",
      amountIn: "1000000",
    };

    it("returns swap result from kit.swap", async () => {
      const result = await handlers.sunswap_swap(params);
      const data = jsonOf(result);

      expect(data.txid).toBe("tx-swap");
      expect(data.route.amountOut).toBe("990000");
      expect(kit.swap).toHaveBeenCalledWith(expect.objectContaining(params));
    });

    it("forwards optional slippage and network", async () => {
      await handlers.sunswap_swap({ ...params, network: "nile", slippage: 0.01 });
      expect(kit.swap).toHaveBeenCalledWith(
        expect.objectContaining({ network: "nile", slippage: 0.01 }),
      );
    });

    it("returns isError on failure", async () => {
      kit.swap.mockRejectedValueOnce(new Error("route not found"));
      const result = await handlers.sunswap_swap(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("route not found");
    });
  });

  describe("sunswap_send_contract", () => {
    const params = {
      address: "TContract1",
      functionName: "transfer",
      args: ["TRecipient", "1000000"],
    };

    it("returns tx result from kit.sendContractTx", async () => {
      const result = await handlers.sunswap_send_contract(params);
      expect(jsonOf(result).txid).toBe("tx-send");
      expect(kit.sendContractTx).toHaveBeenCalledWith(
        expect.objectContaining({ address: "TContract1", functionName: "transfer", network: "mainnet" }),
      );
    });

    it("returns isError on failure", async () => {
      kit.sendContractTx.mockRejectedValueOnce(new Error("out of bandwidth"));
      const result = await handlers.sunswap_send_contract(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("out of bandwidth");
    });
  });

  describe("sunswap_v2_add_liquidity", () => {
    const params = {
      routerAddress: "TV2Router",
      tokenA: "TTokenA",
      tokenB: "TTokenB",
      amountADesired: "100000",
      amountBDesired: "200000",
    };

    it("delegates to kit.addLiquidityV2", async () => {
      const result = await handlers.sunswap_v2_add_liquidity(params);
      expect(jsonOf(result).txid).toBe("tx-v2-add");
      expect(kit.addLiquidityV2).toHaveBeenCalledWith(expect.objectContaining(params));
    });

    it("returns isError on failure", async () => {
      kit.addLiquidityV2.mockRejectedValueOnce(new Error("slippage too high"));
      const result = await handlers.sunswap_v2_add_liquidity(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("slippage too high");
    });
  });

  describe("sunswap_v2_remove_liquidity", () => {
    const params = {
      routerAddress: "TV2Router",
      tokenA: "TTokenA",
      tokenB: "TTokenB",
      liquidity: "50000",
    };

    it("delegates to kit.removeLiquidityV2", async () => {
      const result = await handlers.sunswap_v2_remove_liquidity(params);
      expect(jsonOf(result).txid).toBe("tx-v2-rm");
      expect(kit.removeLiquidityV2).toHaveBeenCalledWith(expect.objectContaining(params));
    });

    it("returns isError on failure", async () => {
      kit.removeLiquidityV2.mockRejectedValueOnce(new Error("insufficient LP"));
      const result = await handlers.sunswap_v2_remove_liquidity(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("insufficient LP");
    });
  });

  describe("sunswap_v3_mint_position", () => {
    const params = {
      positionManagerAddress: "TV3PM",
      token0: "TToken0",
      token1: "TToken1",
      fee: 3000,
      tickLower: -887220,
      tickUpper: 887220,
      amount0Desired: "100000",
      amount1Desired: "200000",
    };

    it("delegates to kit.mintPositionV3", async () => {
      const result = await handlers.sunswap_v3_mint_position(params);
      const data = jsonOf(result);

      expect(data.txid).toBe("tx-v3-mint");
      expect(data.tokenId).toBe("12345");
      expect(kit.mintPositionV3).toHaveBeenCalledWith(expect.objectContaining(params));
    });

    it("returns isError on failure", async () => {
      kit.mintPositionV3.mockRejectedValueOnce(new Error("tick out of range"));
      const result = await handlers.sunswap_v3_mint_position(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("tick out of range");
    });
  });

  describe("sunswap_v3_increase_liquidity", () => {
    const params = {
      positionManagerAddress: "TV3PM",
      tokenId: "12345",
      amount0Desired: "50000",
      amount1Desired: "100000",
      amount0Min: "49000",
      amount1Min: "98000",
      deadline: 1700000000,
    };

    it("delegates to kit.increaseLiquidityV3", async () => {
      const result = await handlers.sunswap_v3_increase_liquidity(params);
      expect(jsonOf(result).txid).toBe("tx-v3-inc");
      expect(kit.increaseLiquidityV3).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "12345" }));
    });

    it("returns isError on failure", async () => {
      kit.increaseLiquidityV3.mockRejectedValueOnce(new Error("position closed"));
      const result = await handlers.sunswap_v3_increase_liquidity(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("position closed");
    });
  });

  describe("sunswap_v3_decrease_liquidity", () => {
    const params = {
      positionManagerAddress: "TV3PM",
      tokenId: "12345",
      liquidity: "30000",
      amount0Min: "14000",
      amount1Min: "29000",
      deadline: 1700000000,
    };

    it("delegates to kit.decreaseLiquidityV3", async () => {
      const result = await handlers.sunswap_v3_decrease_liquidity(params);
      expect(jsonOf(result).txid).toBe("tx-v3-dec");
      expect(kit.decreaseLiquidityV3).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "12345" }));
    });

    it("returns isError on failure", async () => {
      kit.decreaseLiquidityV3.mockRejectedValueOnce(new Error("not enough liquidity"));
      const result = await handlers.sunswap_v3_decrease_liquidity(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("not enough liquidity");
    });
  });

  // =========================================================================
  // V3 COLLECT
  // =========================================================================

  describe("sunswap_v3_collect", () => {
    const params = {
      positionManagerAddress: "TV3PM",
      tokenId: "12345",
    };

    it("delegates to kit.collectPositionV3", async () => {
      const result = await handlers.sunswap_v3_collect(params);
      const data = jsonOf(result);

      expect(data.estimatedFees.amount0).toBe("100");
      expect(data.estimatedFees.amount1).toBe("200");
      expect(data.txResult.txid).toBe("tx-v3-collect");
      expect(kit.collectPositionV3).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "12345" }));
    });

    it("forwards optional recipient", async () => {
      await handlers.sunswap_v3_collect({ ...params, recipient: "TRecip1" });
      expect(kit.collectPositionV3).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: "TRecip1" }),
      );
    });

    it("returns isError on failure", async () => {
      kit.collectPositionV3.mockRejectedValueOnce(new Error("no fees to collect"));
      const result = await handlers.sunswap_v3_collect(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("no fees to collect");
    });
  });

  // =========================================================================
  // V4 tools
  // =========================================================================

  describe("sunswap_v4_mint_position", () => {
    const params = {
      token0: "TToken0",
      token1: "TToken1",
      fee: 500,
      amount0Desired: "100000",
    };

    it("delegates to kit.mintPositionV4", async () => {
      const result = await handlers.sunswap_v4_mint_position(params);
      const data = jsonOf(result);

      expect(data.txResult.txid).toBe("tx-v4-mint");
      expect(kit.mintPositionV4).toHaveBeenCalledWith(expect.objectContaining({
        token0: "TToken0",
        token1: "TToken1",
      }));
    });

    it("returns isError on failure", async () => {
      kit.mintPositionV4.mockRejectedValueOnce(new Error("pool not found"));
      const result = await handlers.sunswap_v4_mint_position(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("pool not found");
    });
  });

  describe("sunswap_v4_increase_liquidity", () => {
    const params = {
      tokenId: "99",
      token0: "TToken0",
      token1: "TToken1",
      amount0Desired: "50000",
    };

    it("delegates to kit.increaseLiquidityV4", async () => {
      const result = await handlers.sunswap_v4_increase_liquidity(params);
      const data = jsonOf(result);

      expect(data.txResult.txid).toBe("tx-v4-inc");
      expect(kit.increaseLiquidityV4).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "99" }));
    });

    it("returns isError on failure", async () => {
      kit.increaseLiquidityV4.mockRejectedValueOnce(new Error("position not found"));
      const result = await handlers.sunswap_v4_increase_liquidity(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("position not found");
    });
  });

  describe("sunswap_v4_decrease_liquidity", () => {
    const params = {
      tokenId: "99",
      liquidity: "20000",
      token0: "TToken0",
      token1: "TToken1",
    };

    it("delegates to kit.decreaseLiquidityV4", async () => {
      const result = await handlers.sunswap_v4_decrease_liquidity(params);
      const data = jsonOf(result);

      expect(data.txResult.txid).toBe("tx-v4-dec");
      expect(kit.decreaseLiquidityV4).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "99" }));
    });

    it("returns isError on failure", async () => {
      kit.decreaseLiquidityV4.mockRejectedValueOnce(new Error("insufficient liquidity"));
      const result = await handlers.sunswap_v4_decrease_liquidity(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("insufficient liquidity");
    });
  });

  describe("sunswap_v4_collect", () => {
    const params = {
      tokenId: "99",
      token0: "TToken0",
      token1: "TToken1",
      fee: 500,
    };

    it("delegates to kit.collectPositionV4", async () => {
      const result = await handlers.sunswap_v4_collect(params);
      const data = jsonOf(result);

      expect(data.txResult.txid).toBe("tx-v4-collect");
      expect(kit.collectPositionV4).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "99" }));
    });

    it("returns isError on failure", async () => {
      kit.collectPositionV4.mockRejectedValueOnce(new Error("collect failed"));
      const result = await handlers.sunswap_v4_collect(params);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("collect failed");
    });
  });
});
