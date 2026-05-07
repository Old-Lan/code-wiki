import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { IGNORED_DIRS, IGNORED_FILES, LANGUAGE_EXTENSIONS, GENERATED_MARKERS } from '../constants.js';
import { log } from './logger.js';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  const content = await readFile(filePath);
  if (!content) return null;
  return JSON.parse(content) as T;
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

export async function findSourceFiles(
  repoRoot: string,
  extensions?: string[],
): Promise<string[]> {
  const exts = extensions ?? Object.keys(LANGUAGE_EXTENSIONS);
  const patterns = exts.map(ext => `**/*${ext}`);

  const allFiles = await glob(patterns, {
    cwd: repoRoot,
    ignore: IGNORED_DIRS.map(d => `**/${d}/**`),
    nodir: true,
  });

  return allFiles.filter(f => !isIgnoredFile(f));
}

export function isIgnoredFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  if (IGNORED_FILES.includes(basename)) return true;
  if (basename.endsWith('.env') || basename.includes('.secret.') || basename.includes('.credential.')) return true;
  // Ignore common config files at root level
  const configPatterns = [
    /\.config\.(js|ts|json|mjs|cjs)$/,
    /^(webpack|vite|rollup|tsconfig|jest|tailwind|postcss|babel|next|nuxt)\.(config\.)?(js|ts|json|mjs|cjs)$/,
    /^(package-lock|yarn\.lock|pnpm-lock|bun\.lockb)$/,
    /^(LICENSE|README|CONTRIBUTING|CHANGELOG|\.gitignore|\.eslintignore|\.prettierignore)$/,
  ];
  const dir = path.dirname(filePath);
  const isAtRoot = dir === '.' || dir === '';
  if (isAtRoot && configPatterns.some(pattern => pattern.test(basename))) return true;
  return false;
}

export async function isGeneratedFile(filePath: string): Promise<boolean> {
  if (filePath.includes('/generated/') || filePath.includes('\\generated\\')) return true;
  if (filePath.includes('/__generated__/') || filePath.includes('\\__generated__\\')) return true;
  const content = await readFile(filePath);
  if (!content) return false;
  const firstLine = content.split('\n').slice(0, 5).join('\n');
  return GENERATED_MARKERS.some(marker => firstLine.includes(marker));
}

export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath);
  return LANGUAGE_EXTENSIONS[ext] ?? null;
}