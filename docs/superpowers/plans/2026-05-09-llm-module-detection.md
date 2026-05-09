# LLM-Driven Module Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded heuristic module grouping with LLM-driven detection — MCP server collects file tree and import data, LLM decides how to group files into business-domain modules.

**Architecture:** Add a `module_grouping` parameter to `wiki_init` and `wiki_update`. When absent, server returns raw file tree + detection prompt for the LLM. When present, server uses it directly. Cache the grouping for reuse. Keep heuristic code as fallback.

**Tech Stack:** TypeScript, Zod, MCP SDK

---

### Task 1: Add MODULE_DETECTION_PROMPT to templates

**Files:**
- Modify: `src/prompts/templates.ts`

Add a new prompt template that instructs the LLM to analyze a file tree and return module groupings.

- [ ] **Step 1: Add the MODULE_DETECTION_PROMPT constant**

Append to `src/prompts/templates.ts`:

```typescript
export const MODULE_DETECTION_PROMPT = `You are analyzing a project's directory structure to divide its files into meaningful business-domain modules.

PRINCIPLES:
- Group by business domain, not technical layer
- A domain's router/service/model/schema/repository belong together in ONE module
- Shared infrastructure (core, utils, config, middleware) stays as separate infrastructure modules
- Aim for 5-30 files per module. If a domain has <5 files, consider merging with a related domain
- Module names: lowercase English, hyphen-separated, concise (e.g. "sales", "user-auth", "game-engine")

PROJECT INFO:
- Language: {{language}}
- Framework: {{framework}}

FILE TREE:
{{fileTree}}

IMPORT GRAPH (module-level dependencies):
{{importGraph}}

Respond with JSON matching this shape:
{
  "modules": [
    {
      "name": "module-name",
      "files": ["relative/path/to/file1.py", "relative/path/to/file2.py"],
      "reason": "Brief explanation of what this module covers"
    }
  ]
}

Rules:
- Every source file must appear in exactly one module
- "files" must use relative paths from the project root
- "reason" should be 1-2 sentences describing the module's business purpose
- If the project is too small for meaningful decomposition (<10 files), use a single module
- Do NOT create modules with only 1-2 files unless they are genuinely isolated infrastructure`;
```

- [ ] **Step 2: Verify the template compiles**

Run: `cd /home/kai/projects/code-wiki && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/prompts/templates.ts
git commit -m "feat(detection): add MODULE_DETECTION_PROMPT template"
```

---

### Task 2: Add ModuleGrouping type and cache support

**Files:**
- Modify: `src/types.ts`
- Modify: `src/storage/cache-manager.ts`

Add the ModuleGrouping type and cache methods to store/retrieve LLM grouping decisions.

- [ ] **Step 1: Add ModuleGrouping type to src/types.ts**

Add after the `Manifest` interface (around line 213):

```typescript
// ── LLM Module Grouping ──

export interface ModuleGrouping {
  modules: Array<{
    name: string;
    files: string[];
    reason: string;
  }>;
  detectedAt: string;
  language: SupportedLanguage;
  framework: Framework;
  fileCount: number;
}
```

- [ ] **Step 2: Add grouping cache methods to CacheManager**

Add to `src/storage/cache-manager.ts`:

First, add `ModuleGrouping` to the import on line 1:

```typescript
import type { ModuleWiki, DependencyGraph, Manifest, ProjectOverview, TechStack, ModuleGrouping } from '../types.js';
```

Then add these two methods after the `getCachedTechStack` method (after line 96):

```typescript
  async cacheGrouping(grouping: ModuleGrouping): Promise<void> {
    const groupingPath = path.join(this.paths.cache, 'grouping.json');
    await writeJson(groupingPath, grouping);
    log.info(`Cached module grouping: ${grouping.modules.length} modules`);
  }

  async getCachedGrouping(): Promise<ModuleGrouping | null> {
    const groupingPath = path.join(this.paths.cache, 'grouping.json');
    return readJson<ModuleGrouping>(groupingPath);
  }
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kai/projects/code-wiki && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/storage/cache-manager.ts
git commit -m "feat(detection): add ModuleGrouping type and cache support"
```

---

### Task 3: Add module_grouping parameter to wiki_init

**Files:**
- Modify: `src/tools/wiki-init.ts`

Add an optional `module_grouping` parameter to `wiki_init`. When provided, use it instead of heuristic detection. When absent, return file tree + detection prompt for the LLM.

- [ ] **Step 1: Add import for MODULE_DETECTION_PROMPT**

At the top of `src/tools/wiki-init.ts`, add to imports:

```typescript
import { MODULE_DETECTION_PROMPT } from '../prompts/templates.js';
```

Also add the `ModuleGrouping` type import:

```typescript
import type { ToolDefinition } from './registry.js';
import type { ModuleGrouping } from '../types.js';
```

- [ ] **Step 2: Add `module_grouping` to schema**

In the schema object (around line 16), add a new parameter:

```typescript
schema: {
  force: z.boolean().optional().default(false).describe('Force re-initialization even if .code-wiki/ exists'),
  module_grouping: z.string().optional().describe('JSON string from LLM module detection: { modules: [{ name, files, reason }] }'),
},
```

- [ ] **Step 3: Add new code path for detection prompt**

In the handler function, add a check at the beginning (after `const start = Date.now();`), before the existing detection logic. The full restructured handler:

Replace the entire handler function body with:

```typescript
    handler: async (params) => {
      const start = Date.now();
      const cache = new CacheManager(repoRoot);
      await cache.init();

      // If LLM grouping provided, use it to build modules
      if (params.module_grouping) {
        const grouping: ModuleGrouping = {
          ...JSON.parse(params.module_grouping),
          detectedAt: new Date().toISOString(),
          language: '', framework: 'generic', fileCount: 0,
        };

        const { framework, language } = await detectFramework(repoRoot);
        grouping.language = language;
        grouping.framework = framework;
        grouping.fileCount = grouping.modules.reduce((sum, m) => sum + m.files.length, 0);

        await cache.cacheGrouping(grouping);

        // Build ModuleDefs from grouping
        const { buildModuleDefs } = await import('../engine/module-detector.js');
        const moduleMap = new Map(grouping.modules.map(m => [m.name, m.files.map(f => f.startsWith('/') ? f : f)]));
        const modules = await buildModuleDefs(repoRoot, moduleMap, language);
        const graph = buildDependencyGraph(modules);
        await cache.cacheGraph(graph);

        const commit = await getCurrentCommit(repoRoot);
        const cachedOverview = await cache.getCachedOverview();
        const cachedTechStack = await cache.getCachedTechStack();

        const overview = {
          name: repoRoot.split('/').pop() ?? 'project',
          language, framework,
          architecture: modules.length > 1 ? 'multi-module' : 'single-module',
          modules: modules.map(m => ({
            name: m.name, path: m.path,
            responsibility: `${m.exports.length} exports`,
            keyFiles: m.files.length,
            deps: getDependencies(graph, m.name).internal,
          })),
          entryPoints: modules.filter(m => m.entryFile).map(m => m.entryFile!),
          sharedLibs: [],
          lastUpdated: new Date().toISOString(),
          overview: cachedOverview ?? undefined,
          techStack: cachedTechStack ?? undefined,
        };

        const moduleWikis = modules.map(m => ({
          name: m.name,
          summary: `Run /wiki-update to generate detailed analysis`,
          readWhen: [`Working with ${m.name}`, `Understanding ${m.name} module`],
          responsibility: `Run /wiki-update to generate detailed analysis`,
          boundary: 'Pending LLM analysis',
          keyAbstractions: [], usagePatterns: [], invariants: [], configKeys: [],
          keyTypes: m.types.map(t => t.name),
          exports: m.exports.map(e => e.name),
          dependencies: getDependencies(graph, m.name),
          dependents: [], relatedModules: [], gotchas: [],
        }));

        const written = await writeTeamWiki(repoRoot, overview, moduleWikis, []);
        log.info(`wiki_init (LLM grouping) completed in ${Date.now() - start}ms`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'initialized',
              groupingSource: 'llm',
              framework, language,
              moduleCount: modules.length,
              filesWritten: written.length,
              modules: modules.map(m => ({
                name: m.name, path: m.path,
                exports: m.exports.length, types: m.types.length,
              })),
              nextStep: 'Run /wiki-update to generate detailed content for each module',
            }, null, 2),
          }],
        };
      }

      // No grouping provided — check for cached grouping or return detection prompt
      const cachedGrouping = await cache.getCachedGrouping();
      if (cachedGrouping) {
        // Reuse cached grouping
        return handleInitWithGrouping(repoRoot, cache, cachedGrouping, start);
      }

      // No grouping available — return file tree + detection prompt for LLM
      return handleInitDetectionPrompt(repoRoot, start);
    },
```

- [ ] **Step 4: Add helper functions outside the tool creator**

Add these helper functions at the bottom of the file (after the closing `}` of `createWikiInitTool`):

```typescript
async function handleInitDetectionPrompt(repoRoot: string, start: number) {
  const { framework, language } = await detectFramework(repoRoot);
  const { findSourceFiles } = await import('../utils/file-utils.js');
  const sourceFiles = await findSourceFiles(repoRoot);

  // Build directory tree string
  const dirTree = buildDirectoryTree(sourceFiles);

  // Build simple import graph
  const importGraph = await buildSimpleImportGraph(repoRoot, sourceFiles);

  const prompt = MODULE_DETECTION_PROMPT
    .replace('{{language}}', language)
    .replace('{{framework}}', framework)
    .replace('{{fileTree}}', dirTree)
    .replace('{{importGraph}}', JSON.stringify(importGraph, null, 2));

  log.info(`wiki_init returning detection prompt (${sourceFiles.length} files)`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'detection_required',
        fileCount: sourceFiles.length,
        language,
        framework,
        instruction: 'Review the file tree and determine module grouping. Then call wiki_init again with { module_grouping: "<JSON>" } where JSON has: { modules: [{ name: "module-name", files: ["relative/path/..."], reason: "..." }] }',
        prompt,
      }, null, 2),
    }],
  };
}

async function handleInitWithGrouping(repoRoot: string, cache: CacheManager, grouping: ModuleGrouping, start: number) {
  const { buildModuleDefs } = await import('../engine/module-detector.js');
  const moduleMap = new Map(grouping.modules.map(m => [m.name, m.files]));
  const modules = await buildModuleDefs(repoRoot, moduleMap, grouping.language);
  const graph = buildDependencyGraph(modules);
  await cache.cacheGraph(graph);

  const commit = await getCurrentCommit(repoRoot);
  const cachedOverview = await cache.getCachedOverview();
  const cachedTechStack = await cache.getCachedTechStack();

  const overview = {
    name: repoRoot.split('/').pop() ?? 'project',
    language: grouping.language, framework: grouping.framework,
    architecture: modules.length > 1 ? 'multi-module' : 'single-module',
    modules: modules.map(m => ({
      name: m.name, path: m.path,
      responsibility: `${m.exports.length} exports`,
      keyFiles: m.files.length,
      deps: getDependencies(graph, m.name).internal,
    })),
    entryPoints: modules.filter(m => m.entryFile).map(m => m.entryFile!),
    sharedLibs: [],
    lastUpdated: new Date().toISOString(),
    overview: cachedOverview ?? undefined,
    techStack: cachedTechStack ?? undefined,
  };

  const moduleWikis = modules.map(m => ({
    name: m.name,
    summary: `Run /wiki-update to generate detailed analysis`,
    readWhen: [`Working with ${m.name}`, `Understanding ${m.name} module`],
    responsibility: `Run /wiki-update to generate detailed analysis`,
    boundary: 'Pending LLM analysis',
    keyAbstractions: [], usagePatterns: [], invariants: [], configKeys: [],
    keyTypes: m.types.map(t => t.name),
    exports: m.exports.map(e => e.name),
    dependencies: getDependencies(graph, m.name),
    dependents: [], relatedModules: [], gotchas: [],
  }));

  const written = await writeTeamWiki(repoRoot, overview, moduleWikis, []);
  log.info(`wiki_init (cached grouping) completed in ${Date.now() - start}ms`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'initialized',
        groupingSource: 'cached',
        framework: grouping.framework, language: grouping.language,
        moduleCount: modules.length,
        filesWritten: written.length,
        modules: modules.map(m => ({
          name: m.name, path: m.path,
          exports: m.exports.length, types: m.types.length,
        })),
        nextStep: 'Run /wiki-update to generate detailed content for each module',
      }, null, 2),
    }],
  };
}
```

- [ ] **Step 5: Add helper functions for file tree and import graph**

Add these utility functions at the bottom of the file:

```typescript
function buildDirectoryTree(files: string[]): string {
  const tree: Record<string, string[]> = {};
  for (const f of files) {
    const parts = f.split('/');
    if (parts.length <= 1) {
      tree['.'] = tree['.'] ?? [];
      tree['.'].push(f);
    } else {
      const dir = parts.slice(0, -1).join('/');
      tree[dir] = tree[dir] ?? [];
      tree[dir].push(parts[parts.length - 1]);
    }
  }
  const lines: string[] = [];
  for (const [dir, fileNames] of Object.entries(tree).sort()) {
    if (dir === '.') {
      lines.push(fileNames.sort().join(', '));
    } else {
      lines.push(`${dir}/`);
      for (const name of fileNames.sort()) {
        lines.push(`  ${name}`);
      }
    }
  }
  return lines.join('\n');
}

async function buildSimpleImportGraph(repoRoot: string, files: string[]): Promise<Record<string, string[]>> {
  const { readFile } = await import('../utils/file-utils.js');
  const { registry } = await import('../engine/language-registry.js');
  const graph: Record<string, string[]> = {};

  for (const file of files.slice(0, 200)) {
    const absPath = file.startsWith('/') ? file : `${repoRoot}/${file}`;
    const content = await readFile(absPath);
    if (!content) continue;

    const analyzer = registry.getByFile(absPath);
    if (analyzer) {
      const analysis = analyzer.analyzeFile(absPath, content);
      const internalImports = analysis.imports
        .filter(i => !i.isExternal)
        .map(i => i.source);
      if (internalImports.length > 0) {
        graph[file] = internalImports;
      }
    }
  }
  return graph;
}
```

- [ ] **Step 6: Export buildModuleDefs from module-detector.ts**

In `src/engine/module-detector.ts`, export the `buildModuleDefs` function by removing the `async` keyword's coupling. Currently it's a module-private function. Add `export` to the function signature:

Change line 257 from:
```typescript
async function buildModuleDefs(
```
To:
```typescript
export async function buildModuleDefs(
```

- [ ] **Step 7: Verify compilation**

Run: `cd /home/kai/projects/code-wiki && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/tools/wiki-init.ts src/engine/module-detector.ts
git commit -m "feat(detection): add module_grouping parameter to wiki_init with LLM detection flow"
```

---

### Task 4: Add module_grouping parameter to wiki_update

**Files:**
- Modify: `src/tools/wiki-update.ts`

Add the same `module_grouping` parameter to `wiki_update`. When no cached grouping exists and none is provided, return the detection prompt before proceeding with analysis.

- [ ] **Step 1: Add imports**

Add at the top of `src/tools/wiki-update.ts`:

```typescript
import { MODULE_DETECTION_PROMPT } from '../prompts/templates.js';
import type { ModuleGrouping } from '../types.js';
```

- [ ] **Step 2: Add module_grouping to schema**

Add to the schema object (after `persist_tech_stack_descriptions`):

```typescript
      module_grouping: z.string().optional().describe('JSON string from LLM module detection. Required if no cached grouping exists.'),
```

- [ ] **Step 3: Add grouping check in handler**

At the beginning of the handler function, after `await cache.init();` (line 31), add:

```typescript
      // Handle module_grouping persistence
      if (params.module_grouping && !params.module && !params.generated_content && !params.persist_overview && !params.persist_tech_stack_descriptions) {
        const grouping: ModuleGrouping = {
          ...JSON.parse(params.module_grouping),
          detectedAt: new Date().toISOString(),
          language, framework: 'generic', fileCount: 0,
        };
        const fw = await detectFramework(repoRoot);
        grouping.language = fw.language;
        grouping.framework = fw.framework;
        grouping.fileCount = grouping.modules.reduce((sum: number, m: { files: string[] }) => sum + m.files.length, 0);
        await cache.cacheGrouping(grouping);
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'grouping_cached', moduleCount: grouping.modules.length }) }],
        };
      }

      // Check for cached grouping; if none, return detection prompt
      const cachedGrouping = await cache.getCachedGrouping();
      if (!cachedGrouping && !params.module && !params.generated_content && !params.persist_overview && !params.persist_tech_stack_descriptions) {
        const { findSourceFiles } = await import('../utils/file-utils.js');
        const sourceFiles = await findSourceFiles(repoRoot);
        const { buildDirectoryTree, buildSimpleImportGraph } = await import('./wiki-init.js');

        const dirTree = buildDirectoryTree(sourceFiles);
        const importGraph = await buildSimpleImportGraph(repoRoot, sourceFiles);
        const fw = await detectFramework(repoRoot);

        const prompt = MODULE_DETECTION_PROMPT
          .replace('{{language}}', fw.language)
          .replace('{{framework}}', fw.framework)
          .replace('{{fileTree}}', dirTree)
          .replace('{{importGraph}}', JSON.stringify(importGraph, null, 2));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'detection_required',
              fileCount: sourceFiles.length,
              language: fw.language,
              framework: fw.framework,
              instruction: 'No module grouping found. Review the file tree and determine module grouping. Then call wiki_update with { module_grouping: "<JSON>" } to cache the grouping, then call again with { scope: "changed" } to proceed.',
              prompt,
            }, null, 2),
          }],
        };
      }
```

- [ ] **Step 4: Use cached grouping for module detection**

In the Mode 1 section (around line 148, the `// Mode 1: Analyze and return data for host LLM` comment), replace the module detection to use cached grouping when available:

Find the block:
```typescript
      // Mode 1: Analyze and return data for host LLM
      const { framework, language } = await detectFramework(repoRoot);
      let modules = await detectModules(repoRoot, framework, language);
```

Replace with:
```typescript
      // Mode 1: Analyze and return data for host LLM
      const { framework, language } = await detectFramework(repoRoot);
      let modules = cachedGrouping
        ? await buildModulesFromGrouping(repoRoot, cachedGrouping, language)
        : await detectModules(repoRoot, framework, language);
```

- [ ] **Step 5: Add buildModulesFromGrouping helper**

Add at the bottom of the file:

```typescript
async function buildModulesFromGrouping(repoRoot: string, grouping: ModuleGrouping, language: string) {
  const { buildModuleDefs } = await import('../engine/module-detector.js');
  const moduleMap = new Map(grouping.modules.map(m => [m.name, m.files]));
  return buildModuleDefs(repoRoot, moduleMap, language as any);
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd /home/kai/projects/code-wiki && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/tools/wiki-update.ts
git commit -m "feat(detection): add module_grouping parameter to wiki_update with cached grouping support"
```

---

### Task 5: Export shared helpers from wiki-init

**Files:**
- Modify: `src/tools/wiki-init.ts`

The `buildDirectoryTree` and `buildSimpleImportGraph` functions added in Task 3 are private to wiki-init. Task 4 references them via import. Export them.

- [ ] **Step 1: Export the helper functions**

In `src/tools/wiki-init.ts`, change the two helper function declarations to be exported:

Change:
```typescript
function buildDirectoryTree(files: string[]): string {
```
To:
```typescript
export function buildDirectoryTree(files: string[]): string {
```

Change:
```typescript
async function buildSimpleImportGraph(repoRoot: string, files: string[]): Promise<Record<string, string[]>> {
```
To:
```typescript
export async function buildSimpleImportGraph(repoRoot: string, files: string[]): Promise<Record<string, string[]>> {
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/kai/projects/code-wiki && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/wiki-init.ts
git commit -m "refactor(detection): export buildDirectoryTree and buildSimpleImportGraph helpers"
```

---

### Task 6: Update plugin commands for new two-step flow

**Files:**
- Modify: `plugin/commands/wiki-init.md`
- Modify: `plugin/commands/wiki-update.md`

Update the slash command instructions to document the new two-step detection flow.

- [ ] **Step 1: Update wiki-init.md**

Replace the content of `plugin/commands/wiki-init.md` with:

```markdown
Initialize Code Wiki for the current project.

IMPORTANT: You MUST use the `wiki_init` MCP tool (mcp__code-wiki__wiki_init). Do NOT use `npx code-wiki init` or any Bash/CLI command.

Steps:
1. Call `wiki_init({ force: false })` via MCP tool
2. Check the response status:
   - If `status: "detection_required"`:
     a. Review the `prompt` field — it contains the file tree and import graph
     b. Analyze the project structure and determine module grouping
     c. Group files by business domain (not technical layer)
     d. Call `wiki_init({ module_grouping: "<JSON>" })` where JSON has `{ modules: [{ name: "...", files: [...], reason: "..." }] }`
   - If `status: "initialized"`:
     a. Grouping was already cached or provided
     b. Review the returned module list — confirm the detected modules are correct
3. Report what was detected: framework, language, module count
4. Suggest running `/wiki-update` next to generate detailed content for each module
```

- [ ] **Step 2: Update wiki-update.md**

Replace the content of `plugin/commands/wiki-update.md` with:

```markdown
Update Code Wiki content for changed modules.

Argument: $ARGUMENTS (optional: module path or "full" for complete rebuild)

IMPORTANT: You MUST use the `wiki_update` MCP tool (mcp__code-wiki__wiki_update). Do NOT fall back to `npx code-wiki update` or any Bash/CLI command. The two-phase MCP workflow produces higher quality content than the CLI.

Steps:
1. Call `wiki_update({ scope: "changed" })` (or `{ scope: "full" }` for complete rebuild)
2. Check the response status:
   - If `status: "detection_required"`:
     a. No cached module grouping exists
     b. Review the `prompt` field and determine module grouping
     c. Call `wiki_update({ module_grouping: "<JSON>" })` to cache the grouping
     d. Then call `wiki_update({ scope: "changed" })` again to proceed
   - If `status: "analysis_ready"`:
     a. Review the analysis data returned (AST summary + dependency graph)
     b. Generate wiki content from the analysis: module descriptions, gotchas, boundary definitions
     c. Call `wiki_update({ module: "<name>", generated_content: "<json_string>" })` to persist each module's wiki
     d. Generate and persist the project overview: `wiki_update({ persist_overview: "<json_string>" })`
     e. Optionally generate tech stack descriptions: `wiki_update({ persist_tech_stack_descriptions: "<json_string>" })`
   - If `status: "no_changes"`:
     a. No modules have changed since last update
3. Report what was updated

The two-step pattern ensures wiki content is generated by the host AI (you) without extra API cost.
```

- [ ] **Step 3: Commit**

```bash
git add plugin/commands/
git commit -m "docs(commands): update wiki-init and wiki-update for LLM module detection flow"
```

---

### Task 7: Build and verify

**Files:**
- Verify: `plugins/code-wiki/`

Run the full build to verify everything compiles and the plugin assembles correctly.

- [ ] **Step 1: Run type check**

Run: `cd /home/kai/projects/code-wiki && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full plugin build**

Run: `cd /home/kai/projects/code-wiki && npm run build:plugin`
Expected: Build succeeds

- [ ] **Step 3: Commit build output**

```bash
git add plugins/code-wiki/
git commit -m "build(plugin): rebuild with LLM-driven module detection"
```
