import { z } from 'zod';
import path from 'node:path';
import type { ToolDefinition } from './registry.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { buildDependencyGraph, getDependencies, getDependents } from '../engine/graph-builder.js';
import { CacheManager } from '../storage/cache-manager.js';
import { log } from '../utils/logger.js';

export function createWikiModuleTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_module',
    description: 'Get module details — responsibilities, boundaries, exports, dependencies, gotchas. Use when about to modify or analyze a specific module. IMPORTANT: Use this MCP tool instead of reading source files directly for architecture questions. Returns cached wiki content when available.',
    schema: {
      module_path: z.string().describe('Module path or name'),
      include_flows: z.boolean().optional().default(false).describe('Include flow analysis'),
    },
    handler: async (params) => {
      const start = Date.now();
      const cache = new CacheManager(repoRoot);
      await cache.init();

      // Analyze on miss
      const { framework, language } = await detectFramework(repoRoot);
      const modules = await detectModules(repoRoot, framework, language);
      const mod = modules.find(m => m.name === moduleName || m.path === params.module_path || params.module_path.startsWith(m.path));

      if (!mod) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Module not found: ${params.module_path}`, available: modules.map(m => m.name) }) }] };
      }

      // Try cache first, now that we have the module and its files
      const moduleName = path.basename(params.module_path);
      const isFresh = await cache.isModuleFresh(moduleName, mod.files);
      if (isFresh) {
        const cached = await cache.getCachedModule(moduleName);
        if (cached) {
          log.info(`wiki_module cache hit: ${moduleName}`);
          return { content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }] };
        }
      }

      const graph = await cache.getCachedGraph() ?? buildDependencyGraph(modules);
      const deps = getDependencies(graph, mod.name);
      const dependents = getDependents(graph, mod.name);

      const moduleWiki = {
        name: mod.name,
        responsibility: `Module with ${mod.exports.length} exports and ${mod.types.length} types — requires LLM analysis for description`,
        boundary: 'Requires LLM analysis to determine',
        keyTypes: mod.types.map(t => t.name),
        exports: mod.exports.map(e => `${e.name} (${e.kind})`),
        dependencies: deps,
        dependents,
        gotchas: [],
      };

      log.info(`wiki_module completed in ${Date.now() - start}ms for ${moduleName}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(moduleWiki, null, 2),
        }],
      };
    },
  };
}
