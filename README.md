# Code Wiki

Cross-platform AI coding assistant enhancement — on-demand project context via MCP Server.

Code Wiki analyzes your source code, generates a structured knowledge base, and injects relevant context when your AI assistant needs it. Works with Claude Code, Cursor, Gemini CLI, Codex, and GitHub Copilot CLI.

## Quick Start

```bash
# Install globally
npm install -g code-wiki

# In your project directory
cd your-project
code-wiki init          # Analyze project and generate wiki
code-wiki update        # Incremental update after code changes
code-wiki query "How does authentication work?"  # Natural language query
```

Or use as an MCP server (recommended for AI assistant integration):

```bash
npx code-wiki-server
```

## Architecture

```
┌──────────────┐     MCP (stdio)     ┌──────────────────┐
│  AI Assistant │ ◄────────────────► │  Code Wiki Server │
│ (Claude/Cursor│   wiki_overview     │                  │
│  /Gemini/...) │   wiki_module       │  ┌────────────┐  │
└──────────────┘   wiki_flow          │  │  Analyzers  │  │
                   wiki_query         │  │  TS/Py/Go/  │  │
                   wiki_update        │  │  Java/RS/RB │  │
                   wiki_impact        │  └────────────┘  │
                                      │                  │
                                      │  ┌────────────┐  │
                                      │  │  Storage    │  │
                                      │  │ team/ cache/│  │
                                      │  └────────────┘  │
                                      └──────────────────┘
```

**Two-step LLM delegation**: The MCP server returns raw analysis data (AST, dependency graph). The host AI generates human-readable wiki content — no extra API cost.

**Two-tier storage**: Team wiki (`.code-wiki/team/`, git-committed) + personal cache (`.code-wiki/cache/`, gitignored).

## MCP Tools API

| Tool | Parameters | Returns |
|------|-----------|---------|
| `wiki_overview` | `{ depth: "summary" \| "full" }` | Project modules, architecture, stats |
| `wiki_module` | `{ module_path: string }` | Exports, deps, gotchas, boundaries |
| `wiki_flow` | `{ from: string, to?: string }` | Data/control flow between modules |
| `wiki_query` | `{ question: string }` | Cross-wiki natural language search |
| `wiki_update` | `{ scope: "changed" \| "full", paths?: string[] }` | Refresh wiki content |
| `wiki_impact` | `{ target: string, change_type: string }` | Impact analysis for proposed changes |

## Supported Languages

| Language | Extensions | Export Detection |
|----------|-----------|-----------------|
| TypeScript/JS | `.ts` `.tsx` `.js` `.jsx` | `export` keyword |
| Python | `.py` | Module-level defs (no `_` prefix) |
| Go | `.go` | Uppercase first character |
| Java | `.java` | `public` modifier |
| Rust | `.rs` | `pub` keyword |
| Ruby | `.rb` | Public methods, constants |

## Platform Adapters

### Claude Code

```bash
cd your-project
bash path/to/code-wiki/adapters/claude-code/install.sh
# Restart Claude Code, then run /wiki-init
```

Provides: auto-context skill, 4 slash commands (`/wiki-init`, `/wiki-update`, `/wiki-query`, `/wiki-verify`).

### Cursor

```bash
bash path/to/code-wiki/adapters/cursor/install.sh
# Restart Cursor
```

Provides: MCP config, auto-context rule for source file edits.

### Gemini CLI

```bash
bash path/to/code-wiki/adapters/gemini-cli/install.sh
# Restart Gemini CLI
```

Provides: `GEMINI.md` instructions, wiki-context skill, init/query commands.

### Codex

```bash
bash path/to/code-wiki/adapters/codex/install.sh
```

Provides: `AGENTS.md` instructions.

### GitHub Copilot CLI

```bash
bash path/to/code-wiki/adapters/copilot/install.sh
```

Provides: `mcp.json` MCP server config.

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/wiki-update.yml
on:
  push:
    branches: [main]

jobs:
  wiki:
    uses: your-org/code-wiki/.github/workflows/wiki-update.yml@main
    with:
      wiki-scope: changed
    secrets:
      token: ${{ secrets.GITHUB_TOKEN }}
```

Or use the composite action from `ci/action.yml`.

### GitLab CI

Include the template from `ci/gitlab-ci.yml`:

```yaml
include:
  - local: '/ci/gitlab-ci.yml'
```

Requires a `WIKI_BOT_TOKEN` CI variable for creating merge requests.

## Development

```bash
# Install dependencies
cd code-wiki && npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run lint
```

## Project Structure

```
code-wiki/
├── src/
│   ├── server.ts              # MCP server entry
│   ├── cli.ts                 # CLI entry
│   ├── types.ts               # Shared types
│   ├── engine/
│   │   ├── base-analyzer.ts   # Abstract analyzer
│   │   ├── language-registry.ts
│   │   ├── module-detector.ts
│   │   ├── graph-builder.ts
│   │   ├── flow-tracer.ts
│   │   └── analyzers/         # Language-specific (TS, Py, Go, Java, RS, RB)
│   ├── tools/                 # MCP tool implementations
│   ├── storage/               # Team wiki + cache
│   ├── prompts/               # Wiki generation templates
│   └── utils/                 # File, git, logging
├── adapters/                  # Platform-specific configs
│   ├── claude-code/
│   ├── cursor/
│   ├── gemini-cli/
│   ├── codex/
│   └── copilot/
├── ci/                        # CI/CD templates
└── test/                      # Unit tests + fixtures
```
