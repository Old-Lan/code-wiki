import type { ModuleDef, DependencyGraph, DependencyEdge } from '../types.js';
import { log } from '../utils/logger.js';

export function buildDependencyGraph(modules: ModuleDef[]): DependencyGraph {
  const moduleNames = new Set(modules.map(m => m.name));
  const edgeMap = new Map<string, DependencyEdge>();

  for (const mod of modules) {
    for (const imp of mod.imports) {
      const key = `${mod.name}->${imp.source}:${imp.isExternal}`;
      const existing = edgeMap.get(key);

      if (existing) {
        existing.weight++;
      } else {
        const isInternal = !imp.isExternal && moduleNames.has(imp.source);
        edgeMap.set(key, {
          from: mod.name,
          to: imp.source,
          type: isInternal ? 'internal' : 'external',
          weight: 1,
        });
      }
    }
  }

  const edges = Array.from(edgeMap.values());
  log.debug(`Built dependency graph: ${edges.length} edges`);
  return { modules: Array.from(moduleNames), edges };
}

export function getDependents(graph: DependencyGraph, moduleName: string): string[] {
  return graph.edges
    .filter(e => e.to === moduleName && e.type === 'internal')
    .map(e => e.from);
}

export function getDependencies(graph: DependencyGraph, moduleName: string): { internal: string[]; external: string[] } {
  const internal = graph.edges
    .filter(e => e.from === moduleName && e.type === 'internal')
    .map(e => e.to);
  const external = graph.edges
    .filter(e => e.from === moduleName && e.type === 'external')
    .map(e => e.to);
  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}
