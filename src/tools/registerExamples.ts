import { z } from 'zod';
import type { RegisterToolFn } from '../types';
import { registerSunswapTools } from './sunswap';

/**
 * Example entry point for registering custom tools.
 * Keep this file small and split tools into separate files when they grow.
 */
export function registerCustomTools(registerTool: RegisterToolFn): void {
    registerTool(
        'exampleEcho',
        {
            description: 'Echo text for integration smoke tests',
            inputSchema: {
                message: z.string().min(1).describe('Text to echo back'),
                uppercase: z.boolean().optional().describe('Return uppercased text when true'),
            },
            annotations: {
                title: 'Example Echo',
                readOnlyHint: true,
                idempotentHint: true,
            },
        },
        async ({ message, uppercase }) => {
            const value = uppercase ? message.toUpperCase() : message;
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ echoed: value }),
                    },
                ],
            };
        },
    );

    // SUN.IO / SUNSWAP tools (query + transaction & liquidity management helpers)
    registerSunswapTools(registerTool);
}
