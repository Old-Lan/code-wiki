import { z } from 'zod';
import type { ToolDefinition } from './registry.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { buildDependencyGraph, getDependencies } from '../engine/graph-builder.js';
import { CacheManager } from '../storage/cache-manager.js';
import { writeTeamWiki } from '../storage/team-writer.js';
import { getCurrentCommit } from '../utils/git-utils.js';
import { log } from '../utils/logger.js';

export function createWikiInitTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_init',
    description: 'Initialize Code Wiki for the current project. Detects language, framework, modules, and generates the .code-wiki/ directory structure. IMPORTANT: Use this MCP tool instead of `npx code-wiki init` or any Bash/CLI command.',
    schema: {
      force: z.boolean().optional().default(false).describe('Force re-initialization even if .code-wiki/ exists'),
    },
    handler: async (params) => {
      const start = Date.now();

      const { framework, language } = await detectFramework(repoRoot);
      const modules = await detectModules(repoRoot, framework, language);
      const graph = buildDependencyGraph(modules);
      const commit = await getCurrentCommit(repoRoot);

      const cache = new CacheManager(repoRoot);
      await cache.init();
      await cache.cacheGraph(graph);

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

      log.info(`wiki_init completed in ${Date.now() - start}ms`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'initialized',
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
    },
  };
}
