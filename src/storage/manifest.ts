import type { Manifest, ModuleCacheEntry } from '../types.js';
import { readJson, writeJson } from '../utils/file-utils.js';
import { log } from '../utils/logger.js';

export async function loadManifest(manifestPath: string): Promise<Manifest> {
  const manifest = await readJson<Manifest>(manifestPath);
  if (manifest && manifest.version === 1) return manifest;
  return createEmptyManifest();
}

export function createEmptyManifest(): Manifest {
  return {
    version: 1,
    lastFullBuild: '',
    baseCommit: '',
    modules: {},
  };
}

export async function saveManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  await writeJson(manifestPath, manifest);
  log.debug('Manifest saved', { moduleCount: Object.keys(manifest.modules).length });
}

export function setModuleEntry(
  manifest: Manifest,
  moduleName: string,
  entry: ModuleCacheEntry,
): Manifest {
  return {
    ...manifest,
    modules: { ...manifest.modules, [moduleName]: entry },
  };
}

export function getModuleEntry(manifest: Manifest, moduleName: string): ModuleCacheEntry | undefined {
  return manifest.modules[moduleName];
}

export function getStaleModules(manifest: Manifest): string[] {
  return Object.entries(manifest.modules)
    .filter(([, entry]) => {
      const age = Date.now() - new Date(entry.analyzedAt).getTime();
      return age > 7 * 24 * 60 * 60 * 1000; // 7 days
    })
    .map(([name]) => name);
}
