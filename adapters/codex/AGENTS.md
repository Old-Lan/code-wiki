# Code Wiki Integration for Codex

This project uses Code Wiki — an MCP-powered code knowledge base.

## MCP Tools Available

| Tool | Purpose |
|------|---------|
| `wiki_overview` | Project architecture overview with module list |
| `wiki_module` | Module context: exports, deps, gotchas, boundaries |
| `wiki_flow` | Trace data/control flow between modules |
| `wiki_query` | Natural language query across the wiki |
| `wiki_update` | Refresh wiki for changed modules |
| `wiki_impact` | Analyze change impact across modules |

## Workflow

1. Before editing source files, call `wiki_module({ module_path: "<path>" })` to understand context
2. Use `wiki_overview({ depth: "full" })` for project-wide understanding
3. Use `wiki_flow({ from: "<src>", to: "<dst>" })` to trace dependencies
4. After changes, call `wiki_update({ scope: "changed" })` to keep wiki in sync

## First-Time Setup

1. Call `wiki_overview({ depth: "full" })` to analyze project
2. Call `wiki_update({ scope: "full" })` to generate initial wiki
3. Wiki is stored in `.code-wiki/team/` (committed) and cache in `.code-wiki/cache/` (gitignored)
