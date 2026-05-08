import type { ModuleWiki, DependencyGraph, Manifest, ProjectOverview, TechStack } from '../types.js';
import { wikiPaths } from '../constants.js';
import { readJson, writeJson, ensureDir } from '../utils/file-utils.js';
import { getModuleHash } from '../utils/git-utils.js';
import { loadManifest, saveManifest, setModuleEntry, getModuleEntry } from './manifest.js';
import { log } from '../utils/logger.js';
import path from 'node:path';

export class CacheManager {
  private paths;

  constructor(private repoRoot: string) {
    this.paths = wikiPaths(repoRoot);
  }

  async init(): Promise<void> {
    await ensureDir(this.paths.cache);
    await ensureDir(this.paths.modules('cache'));
    await ensureDir(this.paths.flows('cache'));
    await ensureDir(this.paths.graphs);
  }

  async getManifest(): Promise<Manifest> {
    return loadManifest(this.paths.manifest);
  }

  async isModuleFresh(moduleName: string, moduleFiles: string[]): Promise<boolean> {
    const manifest = await this.getManifest();
    const entry = getModuleEntry(manifest, moduleName);
    if (!entry) return false;

    const currentHash = await getModuleHash(this.repoRoot, moduleFiles);
    return entry.gitHash === currentHash;
  }

  async getCachedModule(moduleName: string): Promise<ModuleWiki | null> {
    const manifest = await this.getManifest();
    const entry = getModuleEntry(manifest, moduleName);
    if (!entry) return null;

    const cachePath = path.join(this.paths.modules('cache'), `${moduleName}.json`);
    return readJson<ModuleWiki>(cachePath);
  }

  async cacheModule(moduleName: string, wiki: ModuleWiki, moduleFiles: string[]): Promise<void> {
    const cachePath = path.join(this.paths.modules('cache'), `${moduleName}.json`);
    await writeJson(cachePath, wiki);

    const gitHash = await getModuleHash(this.repoRoot, moduleFiles);
    const manifest = await this.getManifest();
    const updated = setModuleEntry(manifest, moduleName, {
      cacheFile: `modules/${moduleName}.json`,
      gitHash,
      fileCount: moduleFiles.length,
      analyzedAt: new Date().toISOString(),
    });
    await saveManifest(this.paths.manifest, updated);
    log.info(`Cached module: ${moduleName}`);
  }

  async cacheGraph(graph: DependencyGraph): Promise<void> {
    const graphPath = path.join(this.paths.graphs, 'dependency.json');
    await writeJson(graphPath, graph);
  }

  async getCachedGraph(): Promise<DependencyGraph | null> {
    const graphPath = path.join(this.paths.graphs, 'dependency.json');
    return readJson<DependencyGraph>(graphPath);
  }

  async invalidateModule(moduleName: string): Promise<void> {
    const manifest = await this.getManifest();
    const { [moduleName]: _, ...rest } = manifest.modules;
    await saveManifest(this.paths.manifest, { ...manifest, modules: rest });
    log.debug(`Invalidated cache for module: ${moduleName}`);
  }

  async cacheOverview(overview: ProjectOverview): Promise<void> {
    const overviewPath = path.join(this.paths.cache, 'overview.json');
    await writeJson(overviewPath, overview);
  }

  async getCachedOverview(): Promise<ProjectOverview | null> {
    const overviewPath = path.join(this.paths.cache, 'overview.json');
    return readJson<ProjectOverview>(overviewPath);
  }

  async cacheTechStack(ts: TechStack): Promise<void> {
    const tsPath = path.join(this.paths.cache, 'tech-stack.json');
    await writeJson(tsPath, ts);
  }

  async getCachedTechStack(): Promise<TechStack | null> {
    const tsPath = path.join(this.paths.cache, 'tech-stack.json');
    return readJson<TechStack>(tsPath);
  }
}
