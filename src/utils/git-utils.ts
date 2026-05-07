import { simpleGit, SimpleGit } from 'simple-git';
import { log } from './logger.js';

export async function getRepoRoot(startPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(startPath);
  const root = await git.revparse(['--show-toplevel']);
  return root.trim();
}

export async function getChangedFiles(repoRoot: string, since?: string): Promise<string[]> {
  const git: SimpleGit = simpleGit(repoRoot);
  if (since) {
    const diff = await git.diff(['--name-only', since]);
    return diff.trim().split('\n').filter(Boolean);
  }
  const diff = await git.diff(['--name-only', 'HEAD']);
  return diff.trim().split('\n').filter(Boolean);
}

export async function getFileHashes(repoRoot: string, filePaths: string[]): Promise<Record<string, string>> {
  const git: SimpleGit = simpleGit(repoRoot);
  const hashes: Record<string, string> = {};
  for (const fp of filePaths) {
    try {
      const result = await git.hashObject(fp);
      hashes[fp] = result.trim();
    } catch {
      log.warn(`Could not hash file: ${fp}`);
      hashes[fp] = 'unknown';
    }
  }
  return hashes;
}

export async function getModuleHash(repoRoot: string, moduleFiles: string[]): Promise<string> {
  const hashes = await getFileHashes(repoRoot, moduleFiles);
  const combined = Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|');
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(combined).digest('hex').slice(0, 12);
}

export async function getCurrentCommit(repoRoot: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoRoot);
  const result = await git.revparse(['HEAD']);
  return result.trim().slice(0, 7);
}