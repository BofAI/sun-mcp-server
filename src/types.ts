import type { JSONSchema7 } from 'json-schema'; // npm install --save-dev @types/json-schema
import type { OpenAPIV3 } from 'openapi-types'; // Already installed
import type { z } from 'zod';

// Structure to hold processed info for one API operation -> MCP tool
export interface MappedTool {
    mcpToolDefinition: McpToolDefinition;
    apiCallDetails: ApiCallDetails;
}

// Based on MCP SDK structure (simplified for definition)
export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: JSONSchema7;
    outputSchema?: JSONSchema7; // Optional but recommended
    annotations?: Record<string, any>;
}

// Details needed to make the actual API call
export interface ApiCallDetails {
    method: string; // GET, POST, PUT, DELETE...
    pathTemplate: string; // e.g., /users/{userId}
    serverUrl: string; // Base URL for this specific call
    requestTimeoutMs?: number;
    customHeaders?: Record<string, string>;
    disableXMcp?: boolean;
    parameters: OpenAPIV3.ParameterObject[]; // To help map MCP input back
    requestBody?: OpenAPIV3.RequestBodyObject; // To help map MCP input back
    securityRequirements: OpenAPIV3.SecurityRequirementObject[] | null; // From operation or global spec
    securitySchemes?: Record<string, OpenAPIV3.SecuritySchemeObject>; // Security scheme definitions from OpenAPI components
}

// Representing the parsed and processed OpenAPI spec
// Using `any` for now, ideally use types from a parser library or openapi-types
// export type ProcessedOpenAPI = OpenAPIV3.Document; // Using openapi-types
export type ProcessedOpenAPI = any; // Using 'any' from swagger-parser for simplicity here

// Structure for API client result
export interface ApiClientResponse {
    success: boolean;
    statusCode: number;
    data?: any;
    error?: string;
}

export type RegisterToolFn = <T extends z.ZodRawShape>(
    name: string,
    definition: {
        inputSchema?: T;
        description?: string;
        annotations?: {
            title?: string;
            readOnlyHint?: boolean;
            requiresWallet?: boolean;
            destructiveHint?: boolean;
            idempotentHint?: boolean;
            openWorldHint?: boolean;
        };
    },
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<any>,
) => void;
