---
name: wiki-context
description: Use PROACTIVELY when about to modify code files — automatically fetches module context (responsibilities, boundaries, dependencies, gotchas) so changes are informed by project knowledge. Also use when the user asks about code architecture, module boundaries, or dependency relationships.
user-invocable: false
allowed-tools:
  - mcp__code-wiki__wiki_init
  - mcp__code-wiki__wiki_module
  - mcp__code-wiki__wiki_overview
  - mcp__code-wiki__wiki_impact
  - mcp__code-wiki__wiki_flow
---

# Wiki Context Injection

You have access to project knowledge via Code Wiki MCP tools. Use them to make informed code changes.

## When to Use

Before modifying any file, call `wiki_module` with the target file's module path to get:
- Module responsibility and boundary
- Key types and exports
- Dependencies and dependents
- Known gotchas and pitfalls

## Workflow

1. **Before editing**: Call `wiki_module({ module_path: "<module>" })` for the file you're about to modify
2. **For significant changes**: Call `wiki_impact({ change_description: "...", target_files: ["..."] })` to assess blast radius
3. **For business logic**: Call `wiki_flow({ description: "..." })` to trace the code path
4. **After changes**: Run `/wiki-update` to refresh the wiki

## Context Budget

Each call costs ~300-600 tokens. Only call when the module context is relevant to the task. Skip for trivial changes (typo fixes, comment updates).
