# Code Wiki

Cross-platform AI coding assistant enhancement — on-demand project context via MCP Server.

Code Wiki analyzes your source code, generates a structured knowledge base, and injects relevant context when your AI assistant needs it. Works with Claude Code, Cursor, Gemini CLI, Codex, and GitHub Copilot CLI.

## Quick Start

**Option A: Claude Code Plugin (recommended)**

```
/plugin install code-wiki@marketplace
/wiki-init
/wiki-update
```

**Option B: CLI + MCP Server**

```bash
# Install globally
npm install -g code-wiki

# In your project directory
cd your-project
code-wiki init          # Analyze project and generate wiki skeleton
/wiki-update            # Generate detailed wiki content via MCP
```

## Architecture

```
┌──────────────┐     MCP (stdio)     ┌──────────────────┐
│  AI Assistant │ ◄────────────────► │  Code Wiki Server │
│ (Claude/Cursor│   wiki_init         │                  │
│  /Gemini/...) │   wiki_overview     │  ┌────────────┐  │
└──────────────┘   wiki_module       │  │  Analyzers  │  │
                   wiki_flow          │  │  TS/Py/Go/  │  │
                   wiki_query         │  │  Java/RS/RB │  │
                   wiki_update        │  └────────────┘  │
                   wiki_impact        │                  │
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
| `wiki_init` | `{ force?: boolean }` | Project framework, modules, `.code-wiki/` structure |
| `wiki_overview` | `{ depth: "brief" \| "full" }` | Project modules, architecture, stats |
| `wiki_module` | `{ module_path: string }` | Exports, deps, gotchas, boundaries |
| `wiki_flow` | `{ description: string }` | Code execution path matching description |
| `wiki_query` | `{ question: string, scope?: string[] }` | Analysis data for natural language search |
| `wiki_update` | `{ scope: "changed" \| "full" }` then `{ module, generated_content }` | Two-phase: analysis → LLM generate → persist |
| `wiki_impact` | `{ change_description: string, target_files: string[] }` | Affected modules, suggested tests |

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
# Option 1: Plugin (recommended)
/plugin install code-wiki@marketplace

# Option 2: CLI install
cd your-project
bash path/to/code-wiki/adapters/claude-code/install.sh
# Restart Claude Code, then run /wiki-init
```

Provides: auto-context skill, 7 MCP tools (`wiki_init`, `wiki_overview`, `wiki_module`, `wiki_update`, `wiki_query`, `wiki_flow`, `wiki_impact`), 4 slash commands (`/wiki-init`, `/wiki-update`, `/wiki-query`, `/wiki-verify`).

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
