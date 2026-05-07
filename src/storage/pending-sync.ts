import type { ModuleWiki } from '../types.js';
import { readJson, writeJson, ensureDir, writeFile } from '../utils/file-utils.js';
import { wikiPaths } from '../constants.js';
import { log } from '../utils/logger.js';
import path from 'node:path';

interface PendingItem {
  moduleName: string;
  wiki: ModuleWiki;
  queuedAt: string;
  reason: string;
}

export async function enqueue(repoRoot: string, moduleName: string, wiki: ModuleWiki, reason: string): Promise<void> {
  const paths = wikiPaths(repoRoot);
  const queue = await readJson<PendingItem[]>(paths.pendingSync) ?? [];
  queue.push({ moduleName, wiki, queuedAt: new Date().toISOString(), reason });
  await writeJson(paths.pendingSync, queue);
  log.info(`Enqueued pending sync: ${moduleName} (${reason})`);
}

export async function getPending(repoRoot: string): Promise<PendingItem[]> {
  const paths = wikiPaths(repoRoot);
  return (await readJson<PendingItem[]>(paths.pendingSync)) ?? [];
}

export async function clearPending(repoRoot: string): Promise<void> {
  const paths = wikiPaths(repoRoot);
  await writeJson(paths.pendingSync, []);
  log.info('Cleared pending sync queue');
}

export async function flushPending(repoRoot: string): Promise<string[]> {
  const items = await getPending(repoRoot);
  if (items.length === 0) return [];

  const paths = wikiPaths(repoRoot);
  const written: string[] = [];

  for (const item of items) {
    const modDir = path.join(paths.team, 'modules');
    await ensureDir(modDir);
    const modPath = path.join(modDir, `${item.moduleName}.md`);
    // Write a simple markdown for the pending module
    const content = `# ${item.moduleName}\n\n> Generated: ${item.wiki.responsibility}\n\n## Responsibility\n${item.wiki.responsibility}\n`;
    await writeFile(modPath, content);
    written.push(modPath);
  }

  await clearPending(repoRoot);
  return written;
}
