---
name: wiki-context-brainstorm
description: Use when starting brainstorming or exploring project context — loads project architecture overview, tech stack, and module boundaries from wiki so design decisions align with existing codebase structure.
user-invocable: false
allowed-tools:
  - mcp__code-wiki__wiki_overview
  - mcp__code-wiki__wiki_module
---

# Wiki Context for Brainstorming

Injects project wiki knowledge into the brainstorming workflow.

## When to Use

At the start of brainstorming, during the "Explore project context" step. Also when the user asks about adding features, modifying architecture, or any creative work that benefits from understanding the existing codebase.

## Workflow

1. Call `wiki_overview({ depth: "brief" })` to get:
   - Project architecture pattern (monorepo, src-layout, flat)
   - Module list with responsibilities
   - Entry points and shared libraries
   - Cached overview content (if wiki has been generated)

2. If the brainstorming topic mentions specific modules or areas, also call `wiki_module({ module_path: "<name>" })` for each to get:
   - Module boundary (what it does NOT cover)
   - Key abstractions and types
   - Dependencies and dependents
   - Known gotchas

3. Present the gathered context as a structured summary before asking brainstorming questions:
   ```
   Wiki Context Loaded:
   - Architecture: <pattern>
   - Modules: <count> (<list key ones>)
   - Relevant modules: <details from wiki_module calls>
   - Known constraints: <gotchas, invariants>
   ```

4. Use this context to ask more informed brainstorming questions and ensure proposed designs respect existing module boundaries.

## Graceful Degradation

If `wiki_overview` returns an error or `.code-wiki` directory doesn't exist:
- Skip silently
- Tell the user: "No wiki context available — proceeding with fresh exploration"
- Do NOT block the brainstorming workflow
```