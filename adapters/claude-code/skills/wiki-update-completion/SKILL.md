---
name: wiki-update-completion
description: Use after finishing a development branch and tests pass — automatically updates wiki content for changed modules so documentation stays in sync with code changes.
user-invocable: false
allowed-tools:
  - mcp__code-wiki__wiki_update
  - mcp__code-wiki__wiki_overview
---

# Wiki Update on Branch Completion

Automatically syncs wiki with code changes after development is complete.

## When to Use

After the superpowers finishing-a-development-branch skill verifies tests pass, before presenting the 4 completion options to the user.

## Workflow

1. Call `wiki_update({ scope: "changed" })` to get analysis of changed modules.

2. Check the response status:
   - If `status: "no_changes"` → nothing to update, skip silently
   - If `status: "analysis_ready"` → proceed with content generation

3. For each module in `updatedModules`, generate wiki content using the analysis data:
   - Module summary, responsibility, boundary
   - Key abstractions, usage patterns
   - Invariants, gotchas, dependencies

4. Call `wiki_update({ module: "<name>", generated_content: "<JSON>" })` for each module to persist.

5. Generate and persist project overview:
   `wiki_update({ persist_overview: "<JSON>" })`

6. Optionally persist tech stack descriptions:
   `wiki_update({ persist_tech_stack_descriptions: "<JSON>" })`

7. Report what was updated:
   ```
   Wiki updated: <N> modules synced
   - <module1>: refreshed
   - <module2>: refreshed
   ```

8. Continue with the finishing-a-development-branch flow (present 4 options).

## Constraints

- Run silently — don't ask the user questions about wiki content
- Keep it fast — use cached data where possible
- Don't block the finishing workflow — if wiki update fails, log and continue
- Only update changed modules, not full rebuild

## Graceful Degradation

If wiki_update returns errors or `.code-wiki` doesn't exist:
- Skip silently with no message
- Continue to the 4 completion options
- Do NOT block the branch finishing workflow
```