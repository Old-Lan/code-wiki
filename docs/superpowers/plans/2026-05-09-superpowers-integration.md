# Superpowers Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable bidirectional integration between code-wiki and superpowers — wiki knowledge flows into superpowers workflows, and superpowers development auto-updates wiki on completion.

**Architecture:** Code-wiki provides 4 superpowers-compatible skills + a SessionStart hook. Superpowers is not modified — integration is driven entirely by code-wiki's hook injecting wiki-awareness context, and superpowers' "1% rule" auto-discovering the wiki skills.

**Tech Stack:** TypeScript, MCP SDK, shell scripts, Claude Code plugin system (skills + hooks)

---

### Task 1: Create SessionStart Hook

**Files:**
- Create: `plugin/hooks/hooks.json`
- Create: `plugin/hooks/session-start`

This is the foundation — it injects wiki-awareness into every session so superpowers workflows know to look for wiki skills.

- [ ] **Step 1: Create hooks.json**

Create `plugin/hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/session-start\"",
            "async": false
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Create session-start script**

Create `plugin/hooks/session-start`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Only inject context if MCP server is available (wiki has been initialized)
if [ ! -d ".code-wiki" ]; then
  exit 0
fi

# Escape for JSON embedding
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

WIKI_CONTEXT="Code-Wiki Integration:

This session has code-wiki wiki knowledge available. When using superpowers skills:
- Before brainstorming (during \"Explore project context\"): invoke skill code-wiki:wiki-context-brainstorm to load project wiki context
- Before writing plans (during \"File Structure\" analysis): invoke skill code-wiki:wiki-context-planning to load dependency graphs and module boundaries
- Before code review (when dispatching code-reviewer agent): invoke skill code-wiki:wiki-constraints-review to load architecture constraints as review baseline
- After finishing a branch (after tests pass, before presenting options): invoke skill code-wiki:wiki-update-completion to sync wiki with code changes

If wiki MCP tools are unavailable, skip wiki integration silently — never block the superpowers workflow."

ESCAPED=$(escape_for_json "$WIKI_CONTEXT")

# Claude Code format
printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$ESCAPED"

exit 0
```

- [ ] **Step 3: Make script executable**

Run: `chmod +x plugin/hooks/session-start`

- [ ] **Step 4: Test hook fires correctly**

Run: `cd /home/kai/projects/code-wiki && bash plugin/hooks/session-start`
Expected: JSON output with `hookSpecificOutput.additionalContext` containing wiki integration instructions

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/
git commit -m "feat(integration): add SessionStart hook for superpowers wiki-awareness"
```

---

### Task 2: Create wiki-context-brainstorm Skill

**Files:**
- Create: `plugin/skills/wiki-context-brainstorm/SKILL.md`

This skill is invoked during brainstorming's "Explore project context" step. It loads project overview and relevant module context so design decisions are informed by existing architecture.

- [ ] **Step 1: Create skill file**

Create `plugin/skills/wiki-context-brainstorm/SKILL.md`:

```markdown
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

- [ ] **Step 2: Verify skill loads correctly**

Run: `cat plugin/skills/wiki-context-brainstorm/SKILL.md`
Expected: Frontmatter with name, description, user-invocable: false, allowed-tools

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/wiki-context-brainstorm/
git commit -m "feat(integration): add wiki-context-brainstorm skill for superpowers"
```

---

### Task 3: Create wiki-context-planning Skill

**Files:**
- Create: `plugin/skills/wiki-context-planning/SKILL.md`

This skill is invoked during writing-plans' "File Structure" analysis. It loads dependency graphs and module boundaries so plans reference actual code structure.

- [ ] **Step 1: Create skill file**

Create `plugin/skills/wiki-context-planning/SKILL.md`:

```markdown
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

- [ ] **Step 2: Verify skill loads correctly**

Run: `cat plugin/skills/wiki-context-planning/SKILL.md`
Expected: Frontmatter with name, description, user-invocable: false, allowed-tools

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/wiki-context-planning/
git commit -m "feat(integration): add wiki-context-planning skill for superpowers"
```

---

### Task 4: Create wiki-constraints-review Skill

**Files:**
- Create: `plugin/skills/wiki-constraints-review/SKILL.md`

This skill is invoked when dispatching the code-reviewer agent. It loads architecture constraints from wiki so the reviewer checks code against documented patterns.

- [ ] **Step 1: Create skill file**

Create `plugin/skills/wiki-constraints-review/SKILL.md`:

```markdown
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

- [ ] **Step 2: Verify skill loads correctly**

Run: `cat plugin/skills/wiki-constraints-review/SKILL.md`
Expected: Frontmatter with name, description, user-invocable: false, allowed-tools

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/wiki-constraints-review/
git commit -m "feat(integration): add wiki-constraints-review skill for superpowers"
```

---

### Task 5: Create wiki-update-completion Skill

**Files:**
- Create: `plugin/skills/wiki-update-completion/SKILL.md`

This skill is invoked after finishing-a-development-branch passes tests. It triggers wiki_update to keep documentation in sync with code changes.

- [ ] **Step 1: Create skill file**

Create `plugin/skills/wiki-update-completion/SKILL.md`:

```markdown
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

- [ ] **Step 2: Verify skill loads correctly**

Run: `cat plugin/skills/wiki-update-completion/SKILL.md`
Expected: Frontmatter with name, description, user-invocable: false, allowed-tools

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/wiki-update-completion/
git commit -m "feat(integration): add wiki-update-completion skill for superpowers"
```

---

### Task 6: Update Build Script to Include New Files

**Files:**
- Modify: `scripts/build-plugin.sh`

The build script needs to copy the new hooks/ and skills/ directories into the assembled plugin.

- [ ] **Step 1: Update build-plugin.sh to copy hooks**

Add after the `# Copy skills` line in `scripts/build-plugin.sh`:

```bash
# Copy hooks
if [ -d "plugin/hooks" ]; then
  cp -r plugin/hooks "$PLUGIN_DIR/hooks"
fi
```

The full modified section should be:

```bash
# Copy commands
cp -r plugin/commands "$PLUGIN_DIR/commands"

# Copy skills
cp -r plugin/skills "$PLUGIN_DIR/skills"

# Copy hooks
if [ -d "plugin/hooks" ]; then
  cp -r plugin/hooks "$PLUGIN_DIR/hooks"
fi
```

- [ ] **Step 2: Verify build script**

Run: `cat scripts/build-plugin.sh`
Expected: Script includes hooks copy step after skills copy

- [ ] **Step 3: Commit**

```bash
git add scripts/build-plugin.sh
git commit -m "build(integration): include hooks in plugin build"
```

---

### Task 7: Update Adapters to Mirror New Skills

**Files:**
- Create: `adapters/claude-code/skills/wiki-context-brainstorm/SKILL.md`
- Create: `adapters/claude-code/skills/wiki-context-planning/SKILL.md`
- Create: `adapters/claude-code/skills/wiki-constraints-review/SKILL.md`
- Create: `adapters/claude-code/skills/wiki-update-completion/SKILL.md`
- Modify: `adapters/claude-code/install.sh`

The adapters directory mirrors the plugin directory for manual installation. Each skill is identical to the plugin version.

- [ ] **Step 1: Create adapter skill directories**

Run:
```bash
mkdir -p adapters/claude-code/skills/wiki-context-brainstorm
mkdir -p adapters/claude-code/skills/wiki-context-planning
mkdir -p adapters/claude-code/skills/wiki-constraints-review
mkdir -p adapters/claude-code/skills/wiki-update-completion
```

- [ ] **Step 2: Copy skill files to adapter directories**

```bash
cp plugin/skills/wiki-context-brainstorm/SKILL.md adapters/claude-code/skills/wiki-context-brainstorm/SKILL.md
cp plugin/skills/wiki-context-planning/SKILL.md adapters/claude-code/skills/wiki-context-planning/SKILL.md
cp plugin/skills/wiki-constraints-review/SKILL.md adapters/claude-code/skills/wiki-constraints-review/SKILL.md
cp plugin/skills/wiki-update-completion/SKILL.md adapters/claude-code/skills/wiki-update-completion/SKILL.md
```

- [ ] **Step 3: Update install.sh to copy new skills**

Modify `adapters/claude-code/install.sh`. After the existing `# Copy skills` section, add the new skill directories:

Change from:
```bash
# Copy skills
cp "$SCRIPT_DIR/skills/wiki-context/SKILL.md" "$TARGET_DIR/skills/wiki-context/SKILL.md"
```

To:
```bash
# Copy skills
mkdir -p "$TARGET_DIR/skills/wiki-context"
cp "$SCRIPT_DIR/skills/wiki-context/SKILL.md" "$TARGET_DIR/skills/wiki-context/SKILL.md"

for skill in wiki-context-brainstorm wiki-context-planning wiki-constraints-review wiki-update-completion; do
  mkdir -p "$TARGET_DIR/skills/$skill"
  cp "$SCRIPT_DIR/skills/$skill/SKILL.md" "$TARGET_DIR/skills/$skill/SKILL.md"
done
```

- [ ] **Step 4: Verify adapter structure**

Run: `find adapters/claude-code/skills -type f`
Expected: 5 skill files (1 existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add adapters/claude-code/
git commit -m "feat(adapters): add superpowers integration skills to claude-code adapter"
```

---

### Task 8: Build Plugin and Verify

**Files:**
- Verify: `plugins/code-wiki/` assembled output

Run the build to assemble everything and verify the output contains all new files.

- [ ] **Step 1: Run build**

Run: `cd /home/kai/projects/code-wiki && npm run build:plugin`
Expected: Build succeeds, no type errors

- [ ] **Step 2: Verify output contains all expected files**

Run: `find plugins/code-wiki -type f`
Expected output should include:
```
plugins/code-wiki/server.cjs
plugins/code-wiki/.mcp.json
plugins/code-wiki/.claude-plugin/plugin.json
plugins/code-wiki/commands/wiki-init.md
plugins/code-wiki/commands/wiki-update.md
plugins/code-wiki/commands/wiki-query.md
plugins/code-wiki/commands/wiki-verify.md
plugins/code-wiki/skills/wiki-context/SKILL.md
plugins/code-wiki/skills/wiki-context-brainstorm/SKILL.md
plugins/code-wiki/skills/wiki-context-planning/SKILL.md
plugins/code-wiki/skills/wiki-constraints-review/SKILL.md
plugins/code-wiki/skills/wiki-update-completion/SKILL.md
plugins/code-wiki/hooks/hooks.json
plugins/code-wiki/hooks/session-start
```

- [ ] **Step 3: Verify session-start is executable**

Run: `ls -la plugins/code-wiki/hooks/session-start`
Expected: `-rwxr-xr-x` (executable)

- [ ] **Step 4: Test hook output**

Run: `cd /home/kai/projects/code-wiki && bash plugins/code-wiki/hooks/session-start | python3 -m json.tool`
Expected: Valid JSON with `hookSpecificOutput.additionalContext` containing superpowers integration instructions

- [ ] **Step 5: Commit**

```bash
git add plugins/code-wiki/
git commit -m "build(plugin): rebuild with superpowers integration skills and hook"
```
