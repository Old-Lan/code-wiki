---
name: wiki-constraints-review
description: Use when dispatching a code review agent — loads architecture constraints, key abstractions, and gotchas from wiki as review baseline so the reviewer validates code against documented patterns and boundaries.
user-invocable: false
allowed-tools:
  - mcp__code-wiki__wiki_module
  - mcp__code-wiki__wiki_query
---

# Wiki Constraints for Code Review

Injects architecture constraints into the code review process.

## When to Use

When dispatching the superpowers code-reviewer agent (via requesting-code-review skill). Also when the user asks for a code review or before merging significant changes.

## Workflow

1. Get the list of changed files from the git diff that triggered the review:
   ```bash
   git diff --name-only <base_sha> <head_sha>
   ```

2. Map changed files to their modules (match file paths to module paths).

3. For each affected module, call `wiki_module({ module_path: "<name>" })` to extract:
   - **Boundary**: What this module does NOT cover — violations are Critical issues
   - **Key abstractions**: Important types/classes — changes to these need careful review
   - **Invariants**: Hard constraints that must always hold — violations are Critical issues
   - **Gotchas**: Known pitfalls — new code should not repeat these

4. Format the extracted constraints as review criteria:
   ```
   Wiki Architecture Constraints for Review:

   Module: <name>
   - Boundary: <what it does NOT cover> — flag code that crosses this boundary
   - Key abstractions: <list> — verify changes respect these contracts
   - Invariants: <list> — verify these still hold after changes
   - Gotchas: <list> — check for known pitfalls

   Cross-module: verify dependency direction matches the documented graph
   ```

5. Inject these constraints into the code-reviewer agent's context alongside the plan and requirements.

## Constraint Severity Mapping

| Wiki Element | Review Issue Level | When to Flag |
|---|---|---|
| Boundary violation | Critical | Code adds responsibilities outside documented boundary |
| Invariant broken | Critical | Change breaks a documented hard constraint |
| Key abstraction changed | Important | Signature or behavior of a key type/class changes |
| Gotcha repeated | Important | New code falls into a documented pitfall |
| Dependency direction reversed | Important | Module now depends on a documented dependent |

## Graceful Degradation

If wiki tools return errors or `.code-wiki` doesn't exist:
- Skip silently
- Proceed with review based on plan and code alone
- Do NOT block the review workflow
```