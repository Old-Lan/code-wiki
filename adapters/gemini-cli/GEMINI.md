# Code Wiki Integration for Gemini CLI

This project uses Code Wiki — an MCP-powered code knowledge base that provides architectural context on demand.

## Available MCP Tools

The following tools are available via the `code-wiki` MCP server:

| Tool | Purpose |
|------|---------|
| `wiki_overview` | Project-level architecture overview with module list |
| `wiki_module` | Detailed module context: exports, deps, gotchas |
| `wiki_flow` | Trace data/control flow between modules |
| `wiki_query` | Natural language query across the wiki |
| `wiki_update` | Refresh wiki content for changed modules |
| `wiki_impact` | Analyze impact of proposed changes |

## When to Use

- **Before editing source files**: Call `wiki_module` to load context about the module you're about to change
- **Understanding architecture**: Call `wiki_overview` to see the project structure
- **Tracing changes**: Call `wiki_flow` to understand how data flows between modules
- **After significant changes**: Call `wiki_update` to keep the wiki in sync

## Workflow

1. When approaching a file edit, first call `wiki_module({ module_path: "<path>" })`
2. Review the returned context — exports, dependencies, and gotchas
3. Make informed edits that respect module boundaries
4. After changes, suggest updating the wiki

## Initialization

If this is a new project, run the wiki initialization:
1. Call `wiki_overview({ depth: "full" })` to analyze the project
2. Call `wiki_update({ scope: "full" })` to generate the initial wiki
