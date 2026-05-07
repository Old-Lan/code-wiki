---
description: Auto-inject Code Wiki module context when editing source files
globs:
  - "src/**/*"
  - "lib/**/*"
  - "pkg/**/*"
  - "app/**/*"
  - "internal/**/*"
  - "cmd/**/*"
alwaysApply: false
---

# Code Wiki Context Injection

When you are about to edit or review a source file, first call `wiki_module` with the file's module path to load its wiki context. This gives you:

- Module description and boundary definition
- Exports, dependencies, and dependents
- Known gotchas and architectural notes

Use this context to make informed edits that respect module boundaries.

## Workflow

1. Before editing file at `src/foo/bar.ts`, call `wiki_module({ module_path: "src/foo" })`
2. Review the returned context — especially dependencies and gotchas
3. If no wiki exists yet, suggest the user run initialization via the wiki tools
4. After making changes, remind the user to update the wiki with `wiki_update`

## Available MCP Tools

- `wiki_overview` — Project-level architecture overview
- `wiki_module` — Detailed module context (exports, deps, gotchas)
- `wiki_flow` — Trace data/control flow between modules
- `wiki_query` — Natural language query across the wiki
- `wiki_update` — Refresh wiki content for changed modules
- `wiki_impact` — Analyze impact of proposed changes
