# Code Wiki Plugin

AI-powered code wiki that auto-generates and maintains project documentation via static analysis and LLM generation.

## What It Does

- **Static analysis**: Detects modules, extracts types/exports/functions, builds dependency graphs
- **LLM-powered wiki**: Generates module documentation, gotchas, usage patterns, invariants
- **MCP integration**: Provides tools for Claude Code to query project knowledge in real-time
- **Incremental updates**: Only re-analyzes changed modules

## Tools Provided

| Tool | Purpose |
| ---- | ------- |
| `wiki_init` | Initialize wiki for current project — detects framework, modules, creates `.code-wiki/` |
| `wiki_overview` | Project architecture overview — modules, entry points, tech stack |
| `wiki_module` | Detailed module context — exports, types, dependencies, gotchas |
| `wiki_update` | Two-phase update: analysis → LLM generation → persist |
| `wiki_query` | Natural language query against project knowledge |
| `wiki_impact` | Assess blast radius of proposed changes |
| `wiki_flow` | Trace code execution paths |

## Commands

- `/wiki-init` — Initialize wiki for current project
- `/wiki-update` — Update wiki for changed modules
- `/wiki-query` — Ask questions about the codebase
- `/wiki-verify` — Check wiki consistency with codebase

## Getting Started

1. Install this plugin via `/plugin install code-wiki@marketplace`
2. Run `/wiki-init` in your project
3. Run `/wiki-update` to generate detailed module documentation
4. The `wiki-context` skill automatically provides context before code changes

## Architecture

The bundled MCP server (`server.cjs`) contains all dependencies — no npm install required. All wiki operations go through MCP tools, not CLI commands. It uses:
- Regex-based AST analysis for TypeScript, Python, Go, Java, Rust, Ruby
- Dependency graph construction from import statements
- Tech stack extraction from package manifests (package.json, pyproject.toml, etc.)

## Requirements

- Node.js >= 20.0.0
- Claude Code with plugin support
