# LLM-Driven Module Detection Design

**Date:** 2026-05-09
**Status:** Approved

## Goal

Replace hardcoded heuristic module detection with LLM-driven detection. The MCP server collects file tree and import data; the LLM decides how to group files into business-domain modules. This makes code-wiki work for any project structure without framework-specific rules.

## Problem

Current `module-detector.ts` uses hardcoded patterns per framework:
- FastAPI: looks for `modules/`, `routers/`, `schemas/`
- React: looks for `src/` subdirectories
- Next.js: looks for `app/`, `pages/`
- Generic: groups by top-level directory

This fails when:
- Project uses non-standard directory names
- Business modules span multiple technical layers (routers/sales + modules/sales)
- Nested project prefixes (backend/src/, frontend/src/)
- Java games, Go microservices, or any structure the rules don't cover

## Architecture

Shift module detection from Phase 1 (MCP server) to Phase 2 (LLM):

```
Before:
  Phase 1 (MCP): file scan → heuristic grouping → AST analysis
  Phase 2 (LLM): generate wiki content per module

After:
  Phase 1 (MCP): file scan → import graph → return raw data + detection prompt
  Phase 2 (LLM): decide module grouping → generate wiki content per module
  Phase 3 (MCP): accept grouping → run AST analysis → persist
```

## Changes

### 1. New Prompt Template: MODULE_DETECTION_PROMPT

Location: `src/prompts/templates.ts`

A new prompt that receives the full file tree and import graph, asks the LLM to divide files into business-domain modules.

Principles conveyed in the prompt:
- Group by business domain, not technical layer
- Same domain's router/service/model/schema belong together
- Shared infrastructure (core, utils, config) stays independent
- Each module should have 5-30 files (merge if too small, split if too large)
- Module names: lowercase English, hyphen-separated
- Return structured JSON with file assignments and reasoning

### 2. New MCP Tool Parameter: module_grouping

In `wiki_init` and `wiki_update` tools, add an optional `module_grouping` parameter:

```typescript
module_grouping: z.string().optional().describe(
  'JSON string from LLM module detection: [{ name: "sales", files: [...], reason: "..." }]'
)
```

When provided, the server skips heuristic detection and uses the LLM's grouping directly.

### 3. Modified wiki_init Flow

```
Step 1: Call wiki_init({}) without module_grouping
  → Server returns: file tree, import graph, MODULE_DETECTION_PROMPT

Step 2: LLM processes the prompt, returns grouping decision

Step 3: Call wiki_init({ module_grouping: "<JSON>" })
  → Server uses LLM grouping for AST analysis and cache initialization
```

### 4. Modified wiki_update Flow

```
Step 1: Call wiki_update({ scope: "changed" })
  → If no cached grouping exists, returns file tree + detection prompt
  → If cached grouping exists, uses it directly

Step 2 (if no cache): LLM processes prompt, returns grouping

Step 3: Call wiki_update({ scope: "changed", module_grouping: "<JSON>" })
  → Server caches the grouping and proceeds with analysis
```

### 5. Simplified module-detector.ts

The `detectModules()` function gains a new code path:

- **If `module_grouping` is provided**: use it directly, skip heuristics
- **If not provided**: use existing heuristics as fallback (for CLI usage or when LLM is unavailable)

The heuristic code is NOT deleted — it becomes the fallback path. This ensures backward compatibility with CLI usage.

### 6. Caching Module Grouping

The `CacheManager` stores the LLM's module grouping in `.code-wiki/cache/grouping.json`.

On subsequent `wiki_update` calls:
- If grouping cache exists and file list hasn't changed significantly → reuse cached grouping
- If new files appeared or files were removed → trigger re-detection via prompt

Significance threshold: if >20% of files changed since last grouping, trigger re-detection.

## File Tree Data Format

The file tree returned by Phase 1:

```json
{
  "root": "/path/to/project",
  "language": "python",
  "framework": "fastapi",
  "files": [
    { "path": "src/routers/sales.py", "imports": ["src.modules.sales.service", "src.schemas.sales"] },
    { "path": "src/modules/sales/service.py", "imports": ["src.core.database", "lightgbm"] },
    ...
  ],
  "directoryTree": "src/\n├── routers/\n│   ├── sales.py\n│   └── inventory.py\n├── modules/\n│   ├── sales/\n│   │   └── service.py\n..."
}
```

## LLM Response Format

```json
{
  "modules": [
    {
      "name": "sales",
      "files": ["src/routers/sales.py", "src/modules/sales/service.py", "src/schemas/sales.py"],
      "reason": "Sales forecasting: API endpoints, service logic, and data schemas"
    },
    {
      "name": "core",
      "files": ["src/core/database.py", "src/core/config.py", "src/utils/helpers.py"],
      "reason": "Shared infrastructure: database, config, utilities"
    }
  ]
}
```

## Backward Compatibility

- **CLI usage**: heuristic detection still works, no LLM required
- **Existing `.code-wiki/` projects**: cached grouping is used; if none exists, falls back to heuristics until next `wiki_init`
- **MCP tools without `module_grouping`**: same behavior as today
- **Heuristic code**: preserved as fallback, not deleted

## Implementation Order

1. Add `MODULE_DETECTION_PROMPT` to templates.ts
2. Add `module_grouping` parameter to wiki_init and wiki_update schemas
3. Add grouping cache to CacheManager
4. Modify module-detector.ts to accept external grouping
5. Modify wiki_init to return file tree + prompt when no grouping provided
6. Modify wiki_update to use cached grouping or prompt for new grouping
7. Update `wiki-init.md` and `wiki-update.md` commands with new two-step flow
8. Test on yuanpuai project to verify improved module granularity
