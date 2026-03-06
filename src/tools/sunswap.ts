import { z } from "zod";
import type { RegisterToolFn } from "../types";
import {
  readContract,
  sendContractTx,
  type ContractCallParams,
  type ContractSendParams,
} from "../sunswap/contracts";
import { getWalletAddress } from "../sunswap/wallet";
import { getBalances } from "../sunswap/balances";
import { quoteExactInput, swapExactInput } from "../sunswap/router";
import { getTokenPrices } from "../sunswap/price";
import { executeSwap } from "../sunswap/swap";
import { addLiquidityV2, removeLiquidityV2 } from "../sunswap/liquidityV2";
import {
  mintPositionV3,
  increaseLiquidityV3,
  decreaseLiquidityV3,
} from "../sunswap/positionsV3";

export function registerSunswapTools(registerTool: RegisterToolFn): void {
  registerTool(
    "sunswap_get_wallet_address",
    {
      description:
        "Get the active TRON wallet address for SUN.IO/SUNSWAP interactions. Prefers local TRON_PRIVATE_KEY / TRON_MNEMONIC, falls back to AgentWallet when configured.",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
      },
      annotations: {
        title: "SUNSwap Get Wallet Address",
        readOnlyHint: true,
        requiresWallet: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ network }: { network?: string }) => {
      const address = await getWalletAddress({ network });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                address,
                network: network || "mainnet",
                message:
                  "This is the TRON wallet address that will be used for SUN.IO/SUNSWAP transactions.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // 1. Account balances (TRX / TRC20)
  registerTool(
    "sunswap_get_balances",
    {
      description:
        "Get TRX and TRC20 balances for a wallet on TRON, useful for SUN.IO/SUNSWAP portfolio views.",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        ownerAddress: z
          .string()
          .optional()
          .describe("Wallet address; if omitted, uses the active SUNSWAP wallet."),
        tokens: z
          .array(
            z.object({
              type: z.enum(["TRX", "TRC20"]).describe("Asset type"),
              tokenAddress: z
                .string()
                .optional()
                .describe("Required for TRC20: token contract address"),
            }),
          )
          .describe(
            "Assets to query. Include at least one entry, e.g. [{ type: 'TRX' }] or TRC20 tokens.",
          ),
      },
      annotations: {
        title: "SUNSwap Get Balances",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({
      network,
      ownerAddress,
      tokens,
    }: {
      network?: string;
      ownerAddress?: string;
      tokens: { type: "TRX" | "TRC20"; tokenAddress?: string }[];
    }) => {
      try {
        const result = await getBalances({
          network,
          ownerAddress,
          tokens: tokens.map((t) => ({
            address: ownerAddress || "",
            type: t.type,
            tokenAddress: t.tokenAddress,
          })),
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting balances: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 2. Quote for exact input swaps via smart router
  registerTool(
    "sunswap_quote_exact_input",
    {
      description:
        "Estimate SUNSWAP smart router swap results (exact input) by calling its quote/view function.",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        routerAddress: z.string().describe("Smart router contract address."),
        functionName: z
          .string()
          .optional()
          .describe(
            "Quote function name on the router (default: quoteExactInput). You may override if router uses a different name, e.g. getAmountsOut.",
          ),
        args: z
          .array(z.any())
          .describe("Arguments passed to the router quote function, in ABI order."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional router ABI; if omitted, TronWeb will attempt to infer it."),
      },
      annotations: {
        title: "SUNSwap Quote Exact Input",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input: {
      network?: string;
      routerAddress: string;
      functionName?: string;
      args: any[];
      abi?: any[];
    }) => {
      try {
        const result = await quoteExactInput({
          network: input.network,
          routerAddress: input.routerAddress,
          functionName: input.functionName,
          args: input.args,
          abi: input.abi,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error quoting swap: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerTool(
    "sunswap_read_contract",
    {
      description:
        "Read data from a TRON smart contract used by SUN.IO/SUNSWAP (view/pure functions only).",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        address: z.string().describe("Contract address in base58 or hex format."),
        functionName: z.string().describe("Name of the view/pure function to call."),
        args: z
          .array(z.any())
          .optional()
          .describe("Optional array of arguments to pass to the function."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional contract ABI; if omitted, TronWeb will attempt to infer it."),
      },
      annotations: {
        title: "SUNSwap Read Contract",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input: ContractCallParams & { network?: string }) => {
      try {
        const result = await readContract(
          {
            address: input.address,
            functionName: input.functionName,
            args: input.args,
            abi: input.abi,
          },
          input.network || "mainnet",
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading contract: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 3. Smart router swapExactInput (state-changing)
  registerTool(
    "sunswap_swap_exact_input",
    {
      description:
        "Execute SUNSWAP smart router swapExactInput (or equivalent) using the pattern: get params -> build unsigned tx -> wallet sign -> broadcast.",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        routerAddress: z.string().describe("Smart router contract address."),
        functionName: z
          .string()
          .optional()
          .describe("Swap function name on the router (default: swapExactInput)."),
        args: z
          .array(z.any())
          .describe("Arguments passed to the router swap function, in ABI order."),
        value: z
          .string()
          .optional()
          .describe("Optional TRX amount in Sun to attach as call value."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional router ABI; if omitted, TronWeb will attempt to infer it."),
      },
      annotations: {
        title: "SUNSwap Router SwapExactInput",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: {
      network?: string;
      routerAddress: string;
      functionName?: string;
      args: any[];
      value?: string;
      abi?: any[];
    }) => {
      try {
        const txResult = await swapExactInput({
          network: input.network,
          routerAddress: input.routerAddress,
          functionName: input.functionName,
          args: input.args,
          value: input.value,
          abi: input.abi,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(txResult, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing swapExactInput: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 4. Token price via SUN.IO API
  registerTool(
    "sunswap_get_token_price",
    {
      description:
        "Get latest token prices from SUN.IO / SUNSWAP public API using token addresses and/or symbols.",
      inputSchema: {
        tokenAddress: z
          .string()
          .optional()
          .describe("Comma-separated TRON token addresses, e.g. TR7N...,TXYZ..."),
        symbol: z
          .string()
          .optional()
          .describe("Comma-separated token symbols, e.g. SUN,TRX,USDT"),
      },
      annotations: {
        title: "SUNSwap Get Token Price",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: { tokenAddress?: string; symbol?: string }) => {
      try {
        const result = await getTokenPrices({
          tokenAddress: input.tokenAddress,
          symbol: input.symbol,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.raw, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching token price: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 5. SUNSWAP V2 liquidity management
  registerTool(
    "sunswap_v2_add_liquidity",
    {
      description:
        "Add liquidity to a SUNSWAP V2-style pool using the canonical addLiquidity(tokenA, tokenB, ... ) interface.",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        routerAddress: z.string().describe("SUNSWAP V2 router contract address."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional router ABI; if omitted, TronWeb will attempt to infer it."),
        tokenA: z.string().describe("Token A contract address."),
        tokenB: z.string().describe("Token B contract address."),
        amountADesired: z.string().describe("Desired amount of token A (raw units)."),
        amountBDesired: z.string().describe("Desired amount of token B (raw units)."),
        amountAMin: z.string().describe("Minimum amount of token A to add."),
        amountBMin: z.string().describe("Minimum amount of token B to add."),
        to: z.string().describe("Recipient address for LP tokens."),
        deadline: z
          .union([z.string(), z.number()])
          .describe("Unix timestamp deadline for the transaction."),
      },
      annotations: {
        title: "SUNSwap V2 Add Liquidity",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: {
      network?: string;
      routerAddress: string;
      abi?: any[];
      tokenA: string;
      tokenB: string;
      amountADesired: string;
      amountBDesired: string;
      amountAMin: string;
      amountBMin: string;
      to: string;
      deadline: string | number;
    }) => {
      try {
        const txResult = await addLiquidityV2({
          network: input.network,
          routerAddress: input.routerAddress,
          abi: input.abi,
          tokenA: input.tokenA,
          tokenB: input.tokenB,
          amountADesired: input.amountADesired,
          amountBDesired: input.amountBDesired,
          amountAMin: input.amountAMin,
          amountBMin: input.amountBMin,
          to: input.to,
          deadline: input.deadline,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(txResult, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error adding V2 liquidity: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerTool(
    "sunswap_v2_remove_liquidity",
    {
      description:
        "Remove liquidity from a SUNSWAP V2-style pool using the canonical removeLiquidity(...) interface.",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        routerAddress: z.string().describe("SUNSWAP V2 router contract address."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional router ABI; if omitted, TronWeb will attempt to infer it."),
        tokenA: z.string().describe("Token A contract address."),
        tokenB: z.string().describe("Token B contract address."),
        liquidity: z.string().describe("Amount of LP tokens to burn."),
        amountAMin: z.string().describe("Minimum amount of token A to receive."),
        amountBMin: z.string().describe("Minimum amount of token B to receive."),
        to: z.string().describe("Recipient of underlying tokens."),
        deadline: z
          .union([z.string(), z.number()])
          .describe("Unix timestamp deadline for the transaction."),
      },
      annotations: {
        title: "SUNSwap V2 Remove Liquidity",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: {
      network?: string;
      routerAddress: string;
      abi?: any[];
      tokenA: string;
      tokenB: string;
      liquidity: string;
      amountAMin: string;
      amountBMin: string;
      to: string;
      deadline: string | number;
    }) => {
      try {
        const txResult = await removeLiquidityV2({
          network: input.network,
          routerAddress: input.routerAddress,
          abi: input.abi,
          tokenA: input.tokenA,
          tokenB: input.tokenB,
          liquidity: input.liquidity,
          amountAMin: input.amountAMin,
          amountBMin: input.amountBMin,
          to: input.to,
          deadline: input.deadline,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(txResult, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error removing V2 liquidity: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 6. SUNSWAP V3 liquidity positions
  registerTool(
    "sunswap_v3_mint_position",
    {
      description:
        "Mint a new SUNSWAP V3-style concentrated liquidity position via NonfungiblePositionManager.mint(params).",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        positionManagerAddress: z
          .string()
          .describe("SUNSWAP V3 NonfungiblePositionManager contract address."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional position manager ABI; if omitted, TronWeb will attempt to infer it."),
        token0: z.string().describe("Token0 contract address."),
        token1: z.string().describe("Token1 contract address."),
        fee: z.number().describe("Pool fee tier (e.g. 100, 500, 3000)."),
        tickLower: z.number().describe("Lower tick of the position range."),
        tickUpper: z.number().describe("Upper tick of the position range."),
        amount0Desired: z.string().describe("Desired amount of token0 (raw units)."),
        amount1Desired: z.string().describe("Desired amount of token1 (raw units)."),
        amount0Min: z.string().describe("Minimum amount of token0 to deposit."),
        amount1Min: z.string().describe("Minimum amount of token1 to deposit."),
        recipient: z.string().describe("Recipient of the NFT representing the position."),
        deadline: z
          .union([z.string(), z.number()])
          .describe("Unix timestamp deadline for the transaction."),
      },
      annotations: {
        title: "SUNSwap V3 Mint Position",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: {
      network?: string;
      positionManagerAddress: string;
      abi?: any[];
      token0: string;
      token1: string;
      fee: number;
      tickLower: number;
      tickUpper: number;
      amount0Desired: string;
      amount1Desired: string;
      amount0Min: string;
      amount1Min: string;
      recipient: string;
      deadline: string | number;
    }) => {
      try {
        const txResult = await mintPositionV3({
          network: input.network,
          positionManagerAddress: input.positionManagerAddress,
          abi: input.abi,
          token0: input.token0,
          token1: input.token1,
          fee: input.fee,
          tickLower: input.tickLower,
          tickUpper: input.tickUpper,
          amount0Desired: input.amount0Desired,
          amount1Desired: input.amount1Desired,
          amount0Min: input.amount0Min,
          amount1Min: input.amount1Min,
          recipient: input.recipient,
          deadline: input.deadline,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(txResult, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error minting V3 position: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerTool(
    "sunswap_v3_increase_liquidity",
    {
      description:
        "Increase liquidity of an existing SUNSWAP V3-style position via NonfungiblePositionManager.increaseLiquidity(params).",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        positionManagerAddress: z
          .string()
          .describe("SUNSWAP V3 NonfungiblePositionManager contract address."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional position manager ABI; if omitted, TronWeb will attempt to infer it."),
        tokenId: z.string().describe("Token ID of the V3 position NFT."),
        amount0Desired: z.string().describe("Desired additional amount of token0."),
        amount1Desired: z.string().describe("Desired additional amount of token1."),
        amount0Min: z.string().describe("Minimum additional amount of token0."),
        amount1Min: z.string().describe("Minimum additional amount of token1."),
        deadline: z
          .union([z.string(), z.number()])
          .describe("Unix timestamp deadline for the transaction."),
      },
      annotations: {
        title: "SUNSwap V3 Increase Liquidity",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: {
      network?: string;
      positionManagerAddress: string;
      abi?: any[];
      tokenId: string;
      amount0Desired: string;
      amount1Desired: string;
      amount0Min: string;
      amount1Min: string;
      deadline: string | number;
    }) => {
      try {
        const txResult = await increaseLiquidityV3({
          network: input.network,
          positionManagerAddress: input.positionManagerAddress,
          abi: input.abi,
          tokenId: input.tokenId,
          amount0Desired: input.amount0Desired,
          amount1Desired: input.amount1Desired,
          amount0Min: input.amount0Min,
          amount1Min: input.amount1Min,
          deadline: input.deadline,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(txResult, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error increasing V3 liquidity: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerTool(
    "sunswap_v3_decrease_liquidity",
    {
      description:
        "Decrease liquidity of an existing SUNSWAP V3-style position via NonfungiblePositionManager.decreaseLiquidity(params).",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        positionManagerAddress: z
          .string()
          .describe("SUNSWAP V3 NonfungiblePositionManager contract address."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional position manager ABI; if omitted, TronWeb will attempt to infer it."),
        tokenId: z.string().describe("Token ID of the V3 position NFT."),
        liquidity: z.string().describe("Amount of liquidity to burn."),
        amount0Min: z.string().describe("Minimum amount of token0 to receive."),
        amount1Min: z.string().describe("Minimum amount of token1 to receive."),
        deadline: z
          .union([z.string(), z.number()])
          .describe("Unix timestamp deadline for the transaction."),
      },
      annotations: {
        title: "SUNSwap V3 Decrease Liquidity",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: {
      network?: string;
      positionManagerAddress: string;
      abi?: any[];
      tokenId: string;
      liquidity: string;
      amount0Min: string;
      amount1Min: string;
      deadline: string | number;
    }) => {
      try {
        const txResult = await decreaseLiquidityV3({
          network: input.network,
          positionManagerAddress: input.positionManagerAddress,
          abi: input.abi,
          tokenId: input.tokenId,
          liquidity: input.liquidity,
          amount0Min: input.amount0Min,
          amount1Min: input.amount1Min,
          deadline: input.deadline,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(txResult, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error decreasing V3 liquidity: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerTool(
    "sunswap_send_contract",
    {
      description:
        "Send a state-changing TRON contract transaction for SUN.IO/SUNSWAP, following the pattern: get params -> build unsigned tx -> wallet sign -> broadcast.",
      inputSchema: {
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        address: z.string().describe("Contract address in base58 or hex format."),
        functionName: z
          .string()
          .describe("Name of the state-changing contract function to call (e.g. swap, addLiquidity)."),
        args: z
          .array(z.any())
          .optional()
          .describe("Optional array of arguments to pass to the function."),
        value: z
          .string()
          .optional()
          .describe("Optional TRX amount in Sun to attach as call value."),
        abi: z
          .array(z.any())
          .optional()
          .describe("Optional contract ABI; if omitted, TronWeb will attempt to infer it."),
      },
      annotations: {
        title: "SUNSwap Send Contract Transaction",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: ContractSendParams & { network?: string }) => {
      try {
        const txResult = await sendContractTx({
          address: input.address,
          functionName: input.functionName,
          args: input.args,
          value: input.value,
          abi: input.abi,
          network: input.network || "mainnet",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(txResult, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error sending contract transaction: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Simple swap via Universal Router (tokenIn, tokenOut, amountIn)
  registerTool(
    "sunswap_swap",
    {
      description:
        "Execute a token swap on SUN.IO via the Universal Router. Automatically finds the best route, handles Permit2 approval/signing, and broadcasts the transaction. Only requires tokenIn, tokenOut, and amountIn.",
      inputSchema: {
        tokenIn: z
          .string()
          .describe("Input token contract address (base58). Use TRX address for native TRX."),
        tokenOut: z
          .string()
          .describe("Output token contract address (base58)."),
        amountIn: z
          .string()
          .describe("Amount of input token in raw units (e.g. '1000000' for 1 USDT with 6 decimals)."),
        network: z
          .string()
          .optional()
          .describe("TRON network: mainnet, nile, or shasta (default: mainnet)"),
        slippage: z
          .number()
          .optional()
          .describe("Slippage tolerance as a decimal (e.g. 0.005 for 0.5%). Default: 0.005"),
      },
      annotations: {
        title: "SUNSwap Simple Swap",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: {
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      network?: string;
      slippage?: number;
    }) => {
      try {
        const result = await executeSwap({
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          amountIn: input.amountIn,
          network: input.network,
          slippage: input.slippage,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing swap: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

