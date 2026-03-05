// Type declarations for MCP SDK modules
declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  export class McpServer {
    constructor(options: { name: string; version: string });
    tool(name: string, description: string, handler: (extra: any) => Promise<any>): void;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/server/test.js' {
  export class TestServerTransport {
    constructor();
    callTool(toolName: string, params: any): Promise<any>;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor();
    close(): void;
  }
}

declare module '@modelcontextprotocol/sdk/types.js' {
  export enum ErrorCode {
    InternalError = 'internal_error',
    InvalidParams = 'invalid_params'
  }
  
  export class McpError extends Error {
    constructor(code: ErrorCode, message: string, data?: any);
  }
}
