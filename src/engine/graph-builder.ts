import path from 'node:path';
import type { ModuleDef, DependencyGraph, DependencyEdge } from '../types.js';
import { log } from '../utils/logger.js';

export function buildDependencyGraph(modules: ModuleDef[]): DependencyGraph {
  const moduleNames = new Set(modules.map(m => m.name));
  const edgeMap = new Map<string, DependencyEdge>();

  // Build a path-to-module-name map for resolving relative imports
  const pathToModule = new Map<string, string>();
  for (const mod of modules) {
    // Map module path (directory) to module name
    pathToModule.set(path.normalize(mod.path), mod.name);
    // Also map each file's directory to module name
    for (const file of mod.files) {
      pathToModule.set(path.normalize(path.dirname(file)), mod.name);
    }
  }

  for (const mod of modules) {
    for (const imp of mod.imports) {
      const key = `${mod.name}->${imp.source}:${imp.isExternal}`;
      const existing = edgeMap.get(key);

      if (existing) {
        existing.weight++;
        continue;
      }

      // Try to resolve import source to a module name
      const resolvedModule = resolveImportToModule(imp.source, mod, modules, pathToModule);
      const isInternal = !imp.isExternal && (moduleNames.has(imp.source) || resolvedModule !== null);
      const targetModule = resolvedModule ?? imp.source;

      // Skip self-loops (imports within the same module)
      if (isInternal && targetModule === mod.name) continue;

      edgeMap.set(key, {
        from: mod.name,
        to: targetModule,
        type: isInternal ? 'internal' : 'external',
        weight: 1,
      });
    }
  }

  const edges = Array.from(edgeMap.values());
  log.debug(`Built dependency graph: ${edges.length} edges`);
  return { modules: Array.from(moduleNames), edges };
}

function resolveImportToModule(
  importSource: string,
  fromModule: ModuleDef,
  allModules: ModuleDef[],
  pathToModule: Map<string, string>,
): string | null {
  // 1. Direct module name match
  const moduleNames = new Set(allModules.map(m => m.name));
  if (moduleNames.has(importSource)) return importSource;

  // 2. Python import resolution: from src.modules.sales.service import ...
  // Check if any module path contains the import source path segments
  // Only apply to non-relative imports with dotted paths (Python-style)
  if (importSource.includes('.') && !importSource.startsWith('.')) {
    const sourceSegments = importSource.split('.');

    for (const mod of allModules) {
      if (mod.language !== 'python' && fromModule.language !== 'python') continue;

      // Get relative path segments of the module
      for (const file of mod.files) {
        const fileSegments = file.split(/[/\\]/).map(s => s.replace(/\.\w+$/, ''));
        // Check if the import source segments are contained in the file path
        let matchCount = 0;
        for (const seg of sourceSegments) {
          if (fileSegments.includes(seg)) matchCount++;
        }
        // If most segments match, this import likely points to this module
        if (matchCount >= Math.ceil(sourceSegments.length * 0.6) && matchCount >= 2) {
          return mod.name;
        }
      }
    }
  }

  // 3. Relative path resolution (JS/TS): resolve against from module's files
  if (importSource.startsWith('.')) {
    const fromDir = path.dirname(fromModule.files[0] ?? fromModule.path);
    const resolved = path.normalize(path.resolve(fromDir, importSource));

    // Check if resolved path falls under any module
    for (const [modPath, modName] of pathToModule.entries()) {
      if (resolved.startsWith(modPath) || modPath.startsWith(resolved)) {
        return modName;
      }
    }
  }

  return null;
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
