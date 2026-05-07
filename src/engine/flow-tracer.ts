import type { ModuleDef, FlowDef, FlowStep } from '../types.js';
import { log } from '../utils/logger.js';

export function traceFlows(modules: ModuleDef[]): FlowDef[] {
  const flows: FlowDef[] = [];

  // Identify potential entry points (exported functions in entry-like files)
  for (const mod of modules) {
    const entryFunctions = mod.exports.filter(e => e.kind === 'function');

    for (const func of entryFunctions) {
      const steps = traceCallChain(func.name, func.file, func.line, modules, new Set());
      if (steps.length > 1) {
        flows.push({
          name: func.name,
          description: `Flow starting from ${func.name}()`,
          trigger: `Call to ${func.name}()`,
          steps,
          errorPaths: [],
          relatedModules: [],
        });
      }
    }
  }

  log.info(`Traced ${flows.length} flows`);
  return flows;
}

function traceCallChain(
  functionName: string,
  file: string,
  line: number,
  modules: ModuleDef[],
  visited: Set<string>,
  depth: number = 0,
): FlowStep[] {
  const key = `${file}:${functionName}`;
  if (visited.has(key) || depth > 10) return [];
  visited.add(key);

  const steps: FlowStep[] = [{
    order: depth + 1,
    action: `Call ${functionName}()`,
    file,
    line,
    function: functionName,
  }];

  // Find the function's body to trace what it calls
  const mod = modules.find(m => file.startsWith(m.path) || m.files.includes(file));
  if (!mod) return steps;

  // Look for functions called within this function's imports
  const relatedImports = mod.imports.filter(imp => !imp.isExternal);
  for (const imp of relatedImports) {
    const targetMod = modules.find(m => m.name === imp.source);
    if (!targetMod) continue;

    for (const exp of targetMod.exports) {
      if (imp.specifiers.includes(exp.name)) {
        const subSteps = traceCallChain(exp.name, exp.file, exp.line, modules, visited, depth + 1);
        steps.push(...subSteps);
      }
    }
  }

  return steps;
}