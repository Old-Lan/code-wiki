---
name: wiki-context-planning
description: Use when writing implementation plans or analyzing file structure — loads dependency graphs, module boundaries, and business flow context from wiki so plans accurately reflect real code architecture.
user-invocable: false
allowed-tools:
  - mcp__code-wiki__wiki_module
  - mcp__code-wiki__wiki_flow
  - mcp__code-wiki__wiki_impact
  - mcp__code-wiki__wiki_overview
---

# Wiki Context for Planning

Injects dependency and module boundary knowledge into the planning workflow.

## When to Use

During writing-plans, specifically when analyzing file structure and task decomposition. Also when the user asks to plan changes that touch multiple files or modules.

## Workflow

1. From the spec/design doc, identify which modules are likely affected by the planned work.

2. For each affected module, call `wiki_module({ module_path: "<name>" })` to get:
   - Module responsibility and boundary
   - Key abstractions (types, classes, functions)
   - Internal and external dependencies
   - Known gotchas that might affect the plan

3. If the spec mentions business flows or user-facing features, call `wiki_flow({ description: "<flow description>" })` to trace the code path through modules.

4. Call `wiki_impact({ change_description: "<summary of planned changes>" })` to understand the blast radius.

5. Present findings as structured context for the plan:
   ```
   Wiki Planning Context:
   - Affected modules: <list with responsibilities>
   - Module boundaries: <what each module does NOT cover>
   - Dependency chain: <A → B → C>
   - Business flow: <steps through modules>
   - Impact radius: <direct + transitive dependents>
   - Gotchas: <relevant warnings from wiki>
   ```

6. Use this context to:
   - Ensure plan tasks respect module boundaries
   - Include the correct dependency chain in task ordering
   - Flag modules that might need updates beyond the obvious ones
   - Add gotcha-aware test steps

## Graceful Degradation

If wiki tools return errors or `.code-wiki` doesn't exist:
- Skip silently
- Proceed with plan based on file exploration alone
- Do NOT block the planning workflow
```