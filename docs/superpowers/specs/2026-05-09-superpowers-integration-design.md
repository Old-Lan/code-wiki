# Code-Wiki ↔ Superpowers Deep Integration Design

**Date:** 2026-05-09
**Status:** Approved

## Goal

Enable bidirectional integration between code-wiki and superpowers without modifying superpowers. Code-wiki provides superpowers-compatible skills and hooks so that superpowers workflows automatically leverage wiki knowledge, and wiki is updated after development completes.

## Architecture

Three integration mechanisms, all owned by code-wiki:

1. **4 Wiki Skills** — superpowers-compatible SKILL.md files that call wiki MCP tools
2. **SessionStart Hook** — injects wiki-awareness into the session prompt
3. **Code-reviewer context enhancement** — wiki constraints as review baseline

### Principle: Code-wiki owns everything

Superpowers is not modified. All integration happens on the code-wiki side:
- Skills live in code-wiki's plugin directory
- Hook lives in code-wiki's hooks directory
- Data flows through code-wiki's MCP tools

## Components

### 1. Plugin Directory Structure

```
code-wiki/plugin/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── hooks/
│   ├── hooks.json          # SessionStart hook registration
│   └── session-start       # Hook script injecting wiki-integration context
├── skills/
│   ├── wiki-context-brainstorm/
│   │   └── SKILL.md        # Load project overview before brainstorming
│   ├── wiki-context-planning/
│   │   └── SKILL.md        # Load dependency graph before planning
│   ├── wiki-constraints-review/
│   │   └── SKILL.md        # Load architecture constraints for code review
│   └── wiki-update-completion/
│       └── SKILL.md        # Update wiki after branch completion
├── commands/               # Existing slash commands
└── server.cjs              # MCP server
```

### 2. Four Wiki Skills

#### 2.1 `wiki-context-brainstorm`

**Trigger:** When brainstorming skill runs "Explore project context" step.
**Action:** Calls `wiki_overview` MCP tool, returns project architecture summary.
**Output injected into:** Brainstorming context for informed design decisions.

```
Flow:
brainstorming → "Explore project context" →
  Claude detects wiki-context-brainstorm skill →
    invokes wiki_overview MCP tool →
      returns: tech stack, module list, architecture overview →
        brainstorming continues with enriched context
```

**Skill content includes:**
- Call `wiki_overview` to get project-level context
- If specific modules are mentioned, also call `wiki_module` for those
- Present context as structured input to brainstorming

#### 2.2 `wiki-context-planning`

**Trigger:** When writing-plans skill runs "File Structure" analysis.
**Action:** Calls `wiki_module` + `wiki_flow` for relevant modules, returns dependency graph and module boundaries.
**Output injected into:** Plan's file structure and task decomposition.

```
Flow:
writing-plans → "File Structure" analysis →
  Claude detects wiki-context-planning skill →
    invokes wiki_module (affected modules) + wiki_flow (business flows) →
      returns: dependency graph, module boundaries, public APIs →
        plan references actual dependencies, not assumptions
```

**Skill content includes:**
- Identify which modules are relevant to the planned work
- Call `wiki_module` for each relevant module
- Call `wiki_flow` to understand business flow dependencies
- Call `wiki_impact` to understand change impact radius
- Present findings as structured context for planning

#### 2.3 `wiki-constraints-review`

**Trigger:** When requesting-code-review dispatches the code-reviewer agent.
**Action:** Calls `wiki_query` for affected modules, extracts architecture constraints and key abstractions.
**Output injected into:** Code-reviewer agent context as review baseline.

```
Flow:
requesting-code-review → dispatch code-reviewer agent →
  Claude detects wiki-constraints-review skill →
    invokes wiki_query (affected modules) + wiki_module (constraints) →
      returns: architecture constraints, key abstractions, invariants →
        code-reviewer checks implementation against documented constraints
```

**Skill content includes:**
- Get list of changed files from git diff
- Call `wiki_module` for each affected module
- Extract: key abstractions, invariants, configuration keys, gotchas
- Format as review constraints: "The X module must..." / "Y is a key abstraction that..."
- Inject into code-reviewer agent context

#### 2.4 `wiki-update-completion`

**Trigger:** When finishing-a-development-branch verifies tests pass, before presenting options.
**Action:** Calls `wiki_update --scope changed` to update affected module documentation.
**Output:** Updated wiki files in `.code-wiki/team/`.

```
Flow:
finishing-a-development-branch → tests pass →
  Claude detects wiki-update-completion skill →
    invokes wiki_update MCP tool (scope: changed) →
      Phase 1: static analysis of changed files →
      Phase 2: LLM generates updated wiki content →
      Phase 3: persist to .code-wiki/team/ →
        wiki stays in sync with code
```

**Skill content includes:**
- Call `wiki_update` with `scope: "changed"`
- Handle the two-phase flow: receive analysis → generate content → persist
- Report what was updated
- Run silently (don't block the finishing workflow)

### 3. SessionStart Hook

**File:** `plugin/hooks/hooks.json`
**Trigger:** Session start, clear, compact

The hook injects a context block into the session prompt that tells superpowers workflows to look for wiki skills at specific points:

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

**Injected context content:**

```
Code-Wiki Integration Context:

This session has code-wiki MCP tools available. When using superpowers skills:
- Before brainstorming: invoke skill code-wiki:wiki-context-brainstorm to load project wiki context
- Before writing plans: invoke skill code-wiki:wiki-context-planning to load dependency graphs
- Before code review: invoke skill code-wiki:wiki-constraints-review to load architecture constraints
- After finishing a branch: invoke skill code-wiki:wiki-update-completion to sync wiki with changes

If code-wiki MCP server is not connected, skip wiki integration silently.
```

### 4. Graceful Degradation

All wiki skills must handle the case where MCP tools are unavailable:
- Check if `wiki_overview` / `wiki_update` tools exist before calling
- If not available, silently skip wiki integration
- Never block the superpowers workflow if wiki is down

## Implementation Order

1. **SessionStart hook** — Foundation, injects wiki-awareness
2. **wiki-context-brainstorm** — First skill, simplest (one MCP call)
3. **wiki-context-planning** — Medium complexity (multiple MCP calls)
4. **wiki-constraints-review** — Medium complexity (diff + MCP calls)
5. **wiki-update-completion** — Most complex (two-phase flow)
6. **Plugin rebuild** — Bundle all new files into server.cjs and plugin package
7. **Integration testing** — Verify each skill triggers correctly in superpowers workflows

## Testing Strategy

For each skill:
1. Start a Claude Code session with both plugins enabled
2. Trigger the corresponding superpowers skill
3. Verify wiki MCP tool is called at the right point
4. Verify wiki context appears in the workflow output

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| MCP server not connected | All skills check tool availability and skip silently |
| Context window pressure from wiki data | Skills return concise summaries, not full wiki content |
| Superpowers skill descriptions don't trigger wiki skills | SessionStart hook explicitly tells Claude when to invoke wiki skills |
| Wiki data stale | wiki-update-completion runs on every branch finish |
| Hook conflicts with superpowers hook | Hooks are additive, both run independently |
