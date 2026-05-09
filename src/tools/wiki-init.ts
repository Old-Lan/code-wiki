import { z } from 'zod';
import type { ToolDefinition } from './registry.js';
import type { ModuleGrouping, SupportedLanguage, Framework } from '../types.js';
import { detectFramework } from '../engine/framework-detector.js';
import { buildDependencyGraph, getDependencies } from '../engine/graph-builder.js';
import { CacheManager } from '../storage/cache-manager.js';
import { writeTeamWiki } from '../storage/team-writer.js';
import { getCurrentCommit } from '../utils/git-utils.js';
import { MODULE_DETECTION_PROMPT } from '../prompts/templates.js';
import { log } from '../utils/logger.js';

export function createWikiInitTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_init',
    description: 'Initialize Code Wiki for the current project. Detects language, framework, modules, and generates the .code-wiki/ directory structure. IMPORTANT: Use this MCP tool instead of `npx code-wiki init` or any Bash/CLI command.',
    schema: {
      force: z.boolean().optional().default(false).describe('Force re-initialization even if .code-wiki/ exists'),
      module_grouping: z.string().optional().describe('JSON string from LLM module detection: { modules: [{ name, files, reason }] }'),
    },
    handler: async (params) => {
      const start = Date.now();
      const cache = new CacheManager(repoRoot);
      await cache.init();

      // Path 1: LLM grouping provided — use it directly
      if (params.module_grouping) {
        const { framework, language } = await detectFramework(repoRoot);
        const parsedGrouping = JSON.parse(params.module_grouping);
        const grouping: ModuleGrouping = {
          ...parsedGrouping,
          detectedAt: new Date().toISOString(),
          language,
          framework,
          fileCount: parsedGrouping.modules.reduce((sum: number, m: { files: string[] }) => sum + m.files.length, 0),
        };

        await cache.cacheGrouping(grouping);
        return await initWithModules(repoRoot, cache, grouping.modules.map(m => [m.name, m.files] as [string, string[]]), language, framework, 'llm', start);
      }

      // Path 2: Cached grouping exists — reuse it
      const cachedGrouping = await cache.getCachedGrouping();
      if (cachedGrouping) {
        return await initWithModules(repoRoot, cache, cachedGrouping.modules.map(m => [m.name, m.files] as [string, string[]]), cachedGrouping.language, cachedGrouping.framework, 'cached', start);
      }

      // Path 3: No grouping — return file tree + detection prompt
      return await returnDetectionPrompt(repoRoot, start);
    },
  };
}

async function initWithModules(
  repoRoot: string,
  cache: CacheManager,
  moduleEntries: Array<[string, string[]]>,
  language: SupportedLanguage,
  framework: Framework,
  groupingSource: string,
  start: number,
) {
  const { buildModuleDefs } = await import('../engine/module-detector.js');
  const moduleMap = new Map(moduleEntries);
  const modules = await buildModuleDefs(repoRoot, moduleMap, language);
  const graph = buildDependencyGraph(modules);
  await cache.cacheGraph(graph);

  const commit = await getCurrentCommit(repoRoot);
  const cachedOverview = await cache.getCachedOverview();
  const cachedTechStack = await cache.getCachedTechStack();

  const overview = {
    name: repoRoot.split('/').pop() ?? 'project',
    language,
    framework,
    architecture: modules.length > 1 ? 'multi-module' : 'single-module',
    modules: modules.map(m => ({
      name: m.name,
      path: m.path,
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
    keyAbstractions: [],
    usagePatterns: [],
    invariants: [],
    configKeys: [],
    keyTypes: m.types.map(t => t.name),
    exports: m.exports.map(e => e.name),
    dependencies: getDependencies(graph, m.name),
    dependents: [],
    relatedModules: [],
    gotchas: [],
  }));

  const written = await writeTeamWiki(repoRoot, overview, moduleWikis, []);
  log.info(`wiki_init (${groupingSource} grouping) completed in ${Date.now() - start}ms`);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        status: 'initialized',
        groupingSource,
        framework,
        language,
        moduleCount: modules.length,
        filesWritten: written.length,
        modules: modules.map(m => ({
          name: m.name,
          path: m.path,
          exports: m.exports.length,
          types: m.types.length,
        })),
        nextStep: 'Run /wiki-update to generate detailed content for each module',
      }, null, 2),
    }],
  };
}

async function returnDetectionPrompt(repoRoot: string, start: number) {
  const { framework, language } = await detectFramework(repoRoot);
  const { findSourceFiles } = await import('../utils/file-utils.js');
  const sourceFiles = await findSourceFiles(repoRoot);

  const dirTree = buildDirectoryTree(sourceFiles);
  const importGraph = await buildSimpleImportGraph(repoRoot, sourceFiles);

  const prompt = MODULE_DETECTION_PROMPT
    .replace('{{language}}', language)
    .replace('{{framework}}', framework)
    .replace('{{fileTree}}', dirTree)
    .replace('{{importGraph}}', JSON.stringify(importGraph, null, 2));

  log.info(`wiki_init returning detection prompt (${sourceFiles.length} files)`);

  return {
    content: [{
      type: 'text' as const,
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

export function buildDirectoryTree(files: string[]): string {
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

export async function buildSimpleImportGraph(repoRoot: string, files: string[]): Promise<Record<string, string[]>> {
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
