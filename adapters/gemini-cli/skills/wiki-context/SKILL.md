---
name: wiki-context
description: Auto-inject Code Wiki module context before editing source files
user-invocable: false
allowed-tools:
  - mcp__code-wiki__wiki_overview
  - mcp__code-wiki__wiki_module
  - mcp__code-wiki__wiki_flow
  - mcp__code-wiki__wiki_query
  - mcp__code-wiki__wiki_update
  - mcp__code-wiki__wiki_impact
---

# Wiki Context Skill

Automatically load module context from Code Wiki before editing source files.

## When This Skill Activates

This skill activates when you are about to edit or review a source file. Before making changes, load wiki context to understand the module's role, boundaries, and dependencies.

## Steps

1. Identify the module path of the file you're about to edit (e.g., `src/services` for `src/services/user.ts`)
2. Call `wiki_module({ module_path: "<module_path>" })`
3. Review the returned context:
   - **Exports**: What this module provides to others
   - **Dependencies**: What this module relies on
   - **Dependents**: What relies on this module (breaking changes affect these)
   - **Gotchas**: Known issues or non-obvious behavior
4. If no wiki context exists, suggest running initialization first
5. Proceed with edits informed by the module's boundaries
