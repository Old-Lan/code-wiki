export const MODULE_SUMMARY_PROMPT = `You are analyzing a code module to produce rich, developer-facing documentation. Based on the AST analysis below, generate a structured module summary.

Output JSON matching this shape:
{
  "name": "module-name",
  "summary": "One-sentence module purpose (used as frontmatter summary)",
  "readWhen": ["When you are changing X", "When you need to understand Y"],
  "responsibility": "2-3 sentences describing WHAT this module does and WHY it exists (narrative, not bullet points)",
  "boundary": "What this module explicitly does NOT cover — where its responsibility ends",
  "quickStart": {
    "description": "One sentence explaining the fastest way to get started with this module",
    "codeExample": "Minimal code to bootstrap or use this module (3-8 lines)",
    "language": "typescript"
  },
  "keyAbstractions": [
    { "name": "SymbolName", "kind": "type|function|class|interface|constant", "description": "What this abstraction represents and when to use it" }
  ],
  "usagePatterns": [
    { "title": "Pattern name", "description": "When and how to use this pattern", "codeExample": "actual code snippet showing usage", "language": "typescript" }
  ],
  "invariants": ["Hard constraints that must always hold (e.g. 'Exactly one Gateway per host')"],
  "configKeys": [
    { "key": "some.config.path", "type": "string", "default": "value", "description": "What this config controls" }
  ],
  "keyTypes": ["TypeName1", "TypeName2"],
  "exports": ["exportName1", "exportName2"],
  "dependencies": { "internal": ["module-a"], "external": ["some-npm-pkg"] },
  "dependents": ["module-b"],
  "relatedModules": ["module-c"],
  "gotchas": [
    { "description": "Non-obvious pitfall with specific details", "severity": "warning|caution|note" }
  ]
}

Rules:
- summary: concise one-liner suitable for a docs index page
- readWhen: 2-4 scenarios when a developer should read this doc (e.g. "Adding a new channel plugin", "Debugging WebSocket connection issues")
- responsibility: narrative prose, not bullet points. Explain the module's role in the overall system.
- quickStart: a minimal, copy-paste-ready example that gets a developer running with this module in under 30 seconds. Omit if the module has no public API (e.g. tests, config files).
- keyAbstractions: cover the 3-8 most important types/functions/classes. For each, explain WHAT it represents and WHEN a developer would interact with it. Pick only meaningful abstractions, not trivial helpers.
- usagePatterns: 1-3 common usage patterns with actual code examples extracted from the codebase. Each example should be realistic and show the import + usage.
- invariants: hard rules that must ALWAYS hold. NOT suggestions — things that break the system if violated. (e.g. "All DB operations must use await", "Only one Gateway process per host"). Only include if you find real ones.
- configKeys: configuration entries relevant to this module. Include the config key path, type, default value, and what it controls. Only include if the module has meaningful configuration.
- relatedModules: modules that frequently interact with this one, or that a developer would need to understand alongside this one.
- gotchas: only NON-OBVIOUS pitfalls. severity: "warning" = will cause bugs/data loss, "caution" = subtle behavior that wastes debugging time, "note" = non-obvious but harmless. Do NOT include generic advice.
- Be specific to THIS codebase. Reference actual function names, file paths, and behavior.

AST Analysis:
{{astData}}

Dependency Graph:
{{depData}}

Respond with JSON only.`;

export const FLOW_DESCRIPTION_PROMPT = `You are tracing a business flow through code. Based on the call chain analysis below, describe the flow as a developer-facing walkthrough.

Output JSON matching this shape:
{
  "name": "flow-name",
  "description": "2-3 sentence overview of what this flow accomplishes and why it matters",
  "trigger": "What initiates this flow (e.g. 'User sends a message', 'CLI command wiki_update is called')",
  "steps": [
    { "order": 1, "action": "Business-level description of what happens", "file": "src/module/file.ts", "line": 42, "function": "functionName" }
  ],
  "errorPaths": [
    { "condition": "What goes wrong", "gotoStep": 3, "file": "src/module/file.ts", "line": 55 }
  ],
  "relatedModules": ["module-a", "module-b"]
}

Rules:
- Each step action should describe the BUSINESS INTENT, not code syntax (e.g. "Validate user credentials" not "Call validate() on user object")
- Include the exact file:line reference for each step
- Identify error paths and alternative flows
- trigger: what external event kicks off this flow
- relatedModules: which modules are involved in this flow
- Be specific to THIS codebase

Call Chain:
{{flowData}}

Respond with JSON only.`;

export const GOTCHA_DETECTION_PROMPT = `You are reviewing a module for non-obvious pitfalls. Based on the code analysis below, identify gotchas that could surprise a developer.

Rules:
- Only include things that are non-obvious from reading the API surface
- Focus on: hidden dependencies, ordering requirements, performance traps, security constraints
- Do NOT include obvious things like "handle errors" or "validate input"
- For each gotcha, explain the pitfall AND its consequence (what breaks if you miss it)
- Output a JSON array of strings

Module Analysis:
{{moduleData}}

Respond with a JSON array of strings.`;

export const IMPACT_ANALYSIS_PROMPT = `You are analyzing the impact of a planned code change. Based on the dependency graph and module analysis below, assess what would be affected.

Rules:
- directlyAffected: Modules whose code would need to change
- potentiallyAffected: Modules that might break if not updated
- suggestedTests: Specific test files that should be run
- Be conservative — only flag real risks, not hypothetical ones
- Output valid JSON matching the ImpactResult type

Planned Change:
{{changeDescription}}

Target Files:
{{targetFiles}}

Dependency Graph:
{{depGraph}}

Module Analysis:
{{moduleData}}

Respond with JSON only.`;

export const QUERY_ANSWER_PROMPT = `You are answering a question about a codebase. Based on the analysis below, provide a grounded answer.

Rules:
- Answer concisely, focusing on the specific question
- Include file:line references for every claim
- Set confidence: "high" if you found direct evidence, "medium" if inferred, "low" if uncertain
- If you cannot answer, say so honestly

Question: {{question}}

Module Analysis:
{{moduleData}}

Respond with JSON matching: { answer: string, references: [{file: string, lines: string}], related_modules: string[], confidence: "high"|"medium"|"low" }`;
