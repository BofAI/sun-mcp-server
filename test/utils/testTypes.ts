import type { JSONSchema7 } from 'json-schema';
import type { OpenAPIV3 } from 'openapi-types';
import type { ApiCallDetails, McpToolDefinition } from '../../src/types';

// Extended API call details for testing that includes the properties we use in tests
export interface TestApiCallDetails extends ApiCallDetails {
  operationId: string; // Added for test clarity
  url?: string; // For tests - resolved URL with placeholders
  parameterMapping?: Record<string, { in: string; name: string }>; // For tests to simplify mapping
  requestBodyMapping?: { // For tests
    contentType: string;
    properties: Record<string, { required: boolean }>;
  };
}

// Extended MCP tool definition for testing that includes the properties we use in tests
export interface TestMcpToolDefinition extends McpToolDefinition {
  parameters?: { // For test compatibility
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Type used in tests for a mapped tool
export interface TestMappedTool {
  mcpToolDefinition: TestMcpToolDefinition;
  apiCallDetails: TestApiCallDetails;
}

// Helper function to convert a minimal test API call details to the full interface
export function createTestApiCallDetails(partial: Partial<TestApiCallDetails>): ApiCallDetails {
  return {
    method: partial.method || 'GET',
    pathTemplate: partial.pathTemplate || '',
    serverUrl: partial.serverUrl || 'http://localhost:3000',
    parameters: [],
    securityRequirements: null,
    ...partial,
  };
}

// Helper function to convert a minimal test MCP tool definition to the full interface
export function createTestMcpToolDefinition(partial: Partial<TestMcpToolDefinition>): McpToolDefinition {
  return {
    name: partial.name || 'testTool',
    description: partial.description || 'Test tool',
    inputSchema: partial.inputSchema || { type: 'object', properties: {} } as JSONSchema7,
    ...partial,
  };
}
