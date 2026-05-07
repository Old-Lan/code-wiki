import fs from 'node:fs/promises';
import path from 'node:path';
import type { Framework, SupportedLanguage, ModuleDef, ExportDef, ImportDef, TypeDef, FunctionSig } from '../types.js';
import { findSourceFiles, detectLanguage } from '../utils/file-utils.js';
import { log } from '../utils/logger.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { registry } from './language-registry.js';
import { detectFramework } from './framework-detector.js';

export async function detectModules(
  repoRoot: string,
  framework: Framework,
  language: SupportedLanguage,
): Promise<ModuleDef[]> {
  const detection = await detectFramework(repoRoot);

  if (detection.isMonorepo && detection.subProjects.length > 0) {
    return detectMonorepoModules(repoRoot, detection.subProjects);
  }

  const sourceFiles = await findSourceFiles(repoRoot);
  log.info(`Found ${sourceFiles.length} source files`);

  const moduleMap = await groupFilesIntoModules(repoRoot, sourceFiles, framework, language);
  return buildModuleDefs(repoRoot, moduleMap, language);
}

async function detectMonorepoModules(
  repoRoot: string,
  subProjects: Array<{ name: string; path: string; framework: Framework; language: SupportedLanguage }>,
): Promise<ModuleDef[]> {
  const modules: ModuleDef[] = [];

  for (const sub of subProjects) {
    const sourceFiles = await findSourceFiles(sub.path);
    if (sourceFiles.length === 0) continue;

    log.info(`Sub-project ${sub.name}: ${sourceFiles.length} source files`);
    const moduleMap = await groupFilesIntoModules(sub.path, sourceFiles, sub.framework, sub.language);

    for (const [name, files] of moduleMap.entries()) {
      // Prefix module name with sub-project name if there are multiple modules
      const moduleName = moduleMap.size > 1 ? `${sub.name}-${name}` : sub.name;
      const modDefs = await buildModuleDefs(sub.path, new Map([[moduleName, files]]), sub.language);
      modules.push(...modDefs);
    }
  }

  // Also detect standalone top-level directories (skills/, scripts/, etc.)
  const topLevelFiles = await findSourceFiles(repoRoot);
  const coveredPaths = subProjects.map(s => s.path);
  const standaloneFiles = topLevelFiles.filter(f => {
    const abs = path.resolve(repoRoot, f);
    return !coveredPaths.some(cp => abs.startsWith(cp));
  });

  if (standaloneFiles.length > 0) {
    const standaloneMap = groupGeneric(standaloneFiles);
    const standaloneDefs = await buildModuleDefs(repoRoot, standaloneMap, 'typescript');
    modules.push(...standaloneDefs);
  }

  log.info(`Detected ${modules.length} modules in monorepo: ${modules.map(m => m.name).join(', ')}`);
  return modules;
}

async function groupFilesIntoModules(
  projectRoot: string,
  files: string[],
  framework: Framework,
  language: SupportedLanguage,
): Promise<Map<string, string[]>> {
  // Framework-specific grouping strategies
  if (framework === 'nextjs') {
    return groupNextjsModules(projectRoot, files);
  }

  // Detect FastAPI structure: app/{module}/
  if (language === 'python') {
    const fastApiGrouping = await groupFastApiModules(projectRoot, files);
    if (fastApiGrouping) return fastApiGrouping;
  }

  // Detect React/Vite SPA structure: src/{module}/
  if (language === 'typescript') {
    const reactGrouping = await groupReactModules(projectRoot, files);
    if (reactGrouping) return reactGrouping;
  }

  // Generic fallback
  return groupGeneric(files);
}

async function groupFastApiModules(
  projectRoot: string,
  files: string[],
): Promise<Map<string, string[]> | null> {
  // Check for app/ directory structure (FastAPI convention)
  const appFiles = files.filter(f => f.startsWith('app/') || f.startsWith('src/app/'));
  if (appFiles.length === 0) return null;

  const prefix = files.some(f => f.startsWith('src/app/')) ? 'src/app/' : 'app/';
  const moduleMap = new Map<string, string[]>();

  for (const file of files) {
    if (file.startsWith(prefix)) {
      const afterPrefix = file.slice(prefix.length);
      const parts = afterPrefix.split(path.sep);

      if (parts.length > 1) {
        // Group by first directory under app/ (e.g., app/agents/ → "agents")
        const moduleName = parts[0];
        const existing = moduleMap.get(moduleName) ?? [];
        existing.push(file);
        moduleMap.set(moduleName, existing);
      } else {
        // Files directly in app/ (like main.py, __init__.py) → "core"
        const existing = moduleMap.get('core') ?? [];
        existing.push(file);
        moduleMap.set('core', existing);
      }
    } else {
      // Files outside app/ (like config files at project root)
      const parts = file.split(path.sep);
      const moduleName = parts.length > 1 ? parts[0] : 'root';
      const existing = moduleMap.get(moduleName) ?? [];
      existing.push(file);
      moduleMap.set(moduleName, existing);
    }
  }

  return moduleMap.size > 0 ? moduleMap : null;
}

async function groupReactModules(
  projectRoot: string,
  files: string[],
): Promise<Map<string, string[]> | null> {
  // Check for src/ directory structure (React/Vite convention)
  const srcFiles = files.filter(f => f.startsWith('src/'));
  if (srcFiles.length < 3) return null;

  const moduleMap = new Map<string, string[]>();
  const srcSubdirs = new Set<string>();

  // Collect first-level directories under src/
  for (const file of srcFiles) {
    const afterSrc = file.slice(4); // remove 'src/'
    const parts = afterSrc.split(path.sep);
    if (parts.length > 1 && parts[0]) {
      srcSubdirs.add(parts[0]);
    }
  }

  // Only group by subdirectory if there are multiple distinct subdirectories
  if (srcSubdirs.size < 2) return null;

  for (const file of files) {
    if (file.startsWith('src/')) {
      const afterSrc = file.slice(4);
      const parts = afterSrc.split(path.sep);
      if (parts.length > 1 && parts[0]) {
        const existing = moduleMap.get(parts[0]) ?? [];
        existing.push(file);
        moduleMap.set(parts[0], existing);
      } else {
        const existing = moduleMap.get('src-root') ?? [];
        existing.push(file);
        moduleMap.set('src-root', existing);
      }
    } else {
      // Config files outside src/
      const existing = moduleMap.get('config') ?? [];
      existing.push(file);
      moduleMap.set('config', existing);
    }
  }

  return moduleMap.size > 0 ? moduleMap : null;
}

function groupGeneric(files: string[]): Map<string, string[]> {
  const moduleMap = new Map<string, string[]>();

  for (const file of files) {
    const parts = file.split(path.sep);
    const moduleName = parts.length > 1 ? parts[0] : 'root';
    const existing = moduleMap.get(moduleName) ?? [];
    existing.push(file);
    moduleMap.set(moduleName, existing);
  }

  return moduleMap;
}

async function groupNextjsModules(
  repoRoot: string,
  files: string[],
): Promise<Map<string, string[]>> {
  const moduleMap = new Map<string, string[]>();

  for (const file of files) {
    const parts = file.split(path.sep);

    if (parts[0] === 'app' || parts[0] === 'pages') {
      const routeGroup = parts.slice(0, 2).join('/');
      const existing = moduleMap.get(routeGroup) ?? [];
      existing.push(file);
      moduleMap.set(routeGroup, existing);
    } else if (parts[0] === 'api') {
      const existing = moduleMap.get('api') ?? [];
      existing.push(file);
      moduleMap.set('api', existing);
    } else {
      const existing = moduleMap.get(parts[0]) ?? [];
      existing.push(file);
      moduleMap.set(parts[0], existing);
    }
  }

  return moduleMap;
}

async function buildModuleDefs(
  repoRoot: string,
  moduleMap: Map<string, string[]>,
  language: SupportedLanguage,
): Promise<ModuleDef[]> {
  const modules: ModuleDef[] = [];
  for (const [name, files] of moduleMap.entries()) {
    const absoluteFiles = files.map(f => path.resolve(repoRoot, f));
    const modulePath = absoluteFiles[0] ? path.dirname(absoluteFiles[0]) : name;
    const analyzedFiles = await analyzeModuleFiles(repoRoot, absoluteFiles);
    const fileLang = detectLanguage(absoluteFiles[0] ?? '') ?? language;
    modules.push({
      name,
      path: modulePath,
      language: fileLang as SupportedLanguage,
      files: absoluteFiles,
      entryFile: findEntryFile(absoluteFiles),
      exports: analyzedFiles.exports,
      imports: analyzedFiles.imports,
      types: analyzedFiles.types,
      functions: analyzedFiles.functions,
    });
  }

  log.info(`Detected ${modules.length} modules: ${modules.map(m => m.name).join(', ')}`);
  return modules;
}

function findEntryFile(files: string[]): string | undefined {
  const entryNames = ['index.ts', 'index.tsx', 'index.js', 'main.ts', 'main.go', '__init__.py', 'mod.rs', 'index.rb'];
  return files.find(f => entryNames.includes(path.basename(f)));
}

async function analyzeModuleFiles(
  repoRoot: string,
  files: string[],
): Promise<{ exports: ExportDef[]; imports: ImportDef[]; types: TypeDef[]; functions: FunctionSig[] }> {
  const { readFile } = await import('../utils/file-utils.js');
  const exports: ExportDef[] = [];
  const imports: ImportDef[] = [];
  const types: TypeDef[] = [];
  const functions: FunctionSig[] = [];

  for (const file of files) {
    const content = await readFile(file);
    if (!content) continue;

    const analyzer = registry.getByFile(file);
    if (analyzer) {
      const analysis = analyzer.analyzeFile(file, content);
      exports.push(...analysis.exports);
      imports.push(...analysis.imports);
      types.push(...analysis.types);
      functions.push(...analysis.functions);
    }
  }

  return { exports, imports, types, functions };
}
