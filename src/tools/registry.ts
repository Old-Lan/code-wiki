import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (params: any, extra: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}

export function registerTools(server: McpServer, tools: ToolDefinition[]): void {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema, tool.handler);
  }
}
