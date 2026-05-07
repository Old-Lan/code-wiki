import { z } from 'zod';
import type { ToolDefinition } from './registry.js';
import type { ModuleDef } from '../types.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { buildDependencyGraph, getDependencies } from '../engine/graph-builder.js';
import { CacheManager } from '../storage/cache-manager.js';
import { log } from '../utils/logger.js';

export function createWikiOverviewTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_overview',
    description: 'Get project architecture overview — modules, entry points, tech stack. Use at session start or when needing project-level context.',
    schema: {
      depth: z.enum(['brief', 'full']).optional().default('brief').describe('Detail level'),
    },
    handler: async (params) => {
      const depth = params.depth ?? 'brief';
      const start = Date.now();

      const { framework, language } = await detectFramework(repoRoot);
      const modules = await detectModules(repoRoot, framework, language);
      const graph = buildDependencyGraph(modules);

      const overview = {
        name: repoRoot.split('/').pop(),
        language,
        framework,
        architecture: detectArchitecture(modules),
        modules: modules.map(m => ({
          name: m.name,
          path: m.path,
          responsibility: `${m.exports.length} exports, ${m.types.length} types`,
          keyFiles: m.files.length,
          deps: getDependencies(graph, m.name).internal,
        })),
        entryPoints: modules.filter(m => m.entryFile).map(m => m.path),
        sharedLibs: modules.filter(m => getDependencies(graph, m.name).internal.length === 0).map(m => m.path),
        lastUpdated: new Date().toISOString(),
      };

      // Cache graph for other tools
      const cache = new CacheManager(repoRoot);
      await cache.init();
      await cache.cacheGraph(graph);

      log.info(`wiki_overview completed in ${Date.now() - start}ms`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(overview, null, 2),
        }],
      };
    },
  };
}

function detectArchitecture(modules: ModuleDef[]): string {
  if (modules.length === 1) return 'single-module';
  if (modules.some(m => m.path.includes('packages/') || m.path.includes('apps/'))) return 'monorepo';
  if (modules.some(m => m.path.includes('src/'))) return 'src-layout';
  return 'flat';
}
