import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/registry.js';
import { createWikiOverviewTool } from './tools/wiki-overview.js';
import { createWikiModuleTool } from './tools/wiki-module.js';
import { createWikiFlowTool } from './tools/wiki-flow.js';
import { createWikiQueryTool } from './tools/wiki-query.js';
import { createWikiUpdateTool } from './tools/wiki-update.js';
import { createWikiImpactTool } from './tools/wiki-impact.js';
import { log } from './utils/logger.js';
import './engine/analyzers/index.js';

async function main() {
  const server = new McpServer({
    name: 'code-wiki',
    version: '1.0.0',
  });

  const repoRoot = process.cwd();

  const tools = [
    createWikiOverviewTool(repoRoot),
    createWikiModuleTool(repoRoot),
    createWikiFlowTool(repoRoot),
    createWikiQueryTool(repoRoot),
    createWikiUpdateTool(repoRoot),
    createWikiImpactTool(repoRoot),
  ];

  registerTools(server, tools);
  log.info(`Code Wiki MCP Server started with ${tools.length} tools`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  log.error('Server failed to start', err);
  process.exit(1);
});
