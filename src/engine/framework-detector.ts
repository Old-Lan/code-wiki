import fs from 'node:fs/promises';
import path from 'node:path';
import type { Framework, SupportedLanguage } from '../types.js';
import { log } from '../utils/logger.js';

export interface DetectionResult {
  framework: Framework;
  language: SupportedLanguage;
  configFiles: string[];
  isMonorepo: boolean;
  subProjects: Array<{ name: string; path: string; framework: Framework; language: SupportedLanguage }>;
}

type FrameworkDetector = {
  framework: Framework;
  language: SupportedLanguage;
  detect: (root: string) => Promise<boolean>;
};

function computeMonorepoLanguage(
  subProjects: Array<{ name: string; path: string; framework: Framework; language: SupportedLanguage }>,
): SupportedLanguage {
  const counts: Record<string, number> = {};
  for (const sub of subProjects) {
    counts[sub.language] = (counts[sub.language] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return (sorted[0]?.[0] as SupportedLanguage) ?? 'typescript';
}

const detectors: FrameworkDetector[] = [
  {
    framework: 'fastapi',
    language: 'python',
    detect: async (root) => {
      try {
        const content = await fs.readFile(path.join(root, 'pyproject.toml'), 'utf-8');
        return content.includes('fastapi') || content.includes('uvicorn');
      } catch {
        try {
          const content = await fs.readFile(path.join(root, 'requirements.txt'), 'utf-8');
          return content.includes('fastapi') || content.includes('uvicorn');
        } catch { return false; }
      }
    },
  },
  {
    framework: 'nextjs', language: 'typescript',
    detect: async (root) => {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
        return !!(pkg.dependencies?.next || pkg.devDependencies?.next);
      } catch { return false; }
    },
  },
  {
    framework: 'django', language: 'python',
    detect: async (root) => {
      try {
        await fs.access(path.join(root, 'manage.py'));
        return true;
      } catch { return false; }
    },
  },
  {
    framework: 'spring-boot', language: 'java',
    detect: async (root) => {
      try {
        const pom = await fs.readFile(path.join(root, 'pom.xml'), 'utf-8');
        return pom.includes('spring-boot-starter');
      } catch {
        try {
          const gradle = await fs.readFile(path.join(root, 'build.gradle'), 'utf-8');
          return gradle.includes('spring-boot-starter');
        } catch { return false; }
      }
    },
  },
  {
    framework: 'rails', language: 'ruby',
    detect: async (root) => {
      try {
        await fs.access(path.join(root, 'config', 'routes.rb'));
        return true;
      } catch { return false; }
    },
  },
  {
    framework: 'go-standard', language: 'go',
    detect: async (root) => {
      try {
        await fs.access(path.join(root, 'go.mod'));
        return true;
      } catch { return false; }
    },
  },
  {
    framework: 'rust-workspace', language: 'rust',
    detect: async (root) => {
      try {
        const cargo = await fs.readFile(path.join(root, 'Cargo.toml'), 'utf-8');
        return cargo.includes('[workspace]');
      } catch { return false; }
    },
  },
];

async function detectFastAPI(root: string): Promise<boolean> {
  try {
    const content = await fs.readFile(path.join(root, 'requirements.txt'), 'utf-8');
    return content.includes('fastapi') || content.includes('uvicorn');
  } catch {
    try {
      const content = await fs.readFile(path.join(root, 'pyproject.toml'), 'utf-8');
      return content.includes('fastapi');
    } catch { return false; }
  }
}

async function detectReactVite(root: string): Promise<boolean> {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
    return !!(pkg.dependencies?.react || pkg.devDependencies?.react);
  } catch { return false; }
}

export async function detectFramework(repoRoot: string): Promise<DetectionResult> {
  // Check for monorepo pattern first
  const subProjects = await detectMonorepoSubProjects(repoRoot).catch(() => []);
  if (subProjects.length > 0) {
    const language = computeMonorepoLanguage(subProjects);
    log.info(`Detected monorepo with ${subProjects.length} sub-projects: ${subProjects.map(s => s.name).join(', ')}, primary language: ${language}`);
    return { framework: 'generic', language, configFiles: [], isMonorepo: true, subProjects };
  }

  // Single project detection
  for (const detector of detectors) {
    try {
      if (await detector.detect(repoRoot)) {
        log.info(`Detected framework: ${detector.framework}`);
        return { framework: detector.framework, language: detector.language, configFiles: [], isMonorepo: false, subProjects: [] };
      }
    } catch (e) {
      log.debug(`Detector ${detector.framework} failed`, e);
    }
  }

  // Check FastAPI
  if (await detectFastAPI(repoRoot)) {
    log.info('Detected FastAPI project');
    return { framework: 'fastapi', language: 'python', configFiles: [], isMonorepo: false, subProjects: [] };
  }

  // Fallback: detect primary language from file extensions
  const language = await detectPrimaryLanguage(repoRoot);
  log.info(`No framework detected, primary language: ${language}`);
  return { framework: 'generic', language, configFiles: [], isMonorepo: false, subProjects: [] };
}

async function detectMonorepoSubProjects(
  repoRoot: string,
): Promise<Array<{ name: string; path: string; framework: Framework; language: SupportedLanguage }>> {
  const results: Array<{ name: string; path: string; framework: Framework; language: SupportedLanguage }> = [];
  const entries = await fs.readdir(repoRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subPath = path.join(repoRoot, entry.name);

    // Check if subdirectory looks like a project (has package.json or requirements.txt or pyproject.toml)
    const hasPackageJson = await fileExists(path.join(subPath, 'package.json'));
    const hasRequirements = await fileExists(path.join(subPath, 'requirements.txt'));
    const hasPyproject = await fileExists(path.join(subPath, 'pyproject.toml'));

    if (hasPackageJson) {
      const isFastifyOrExpress = await detectReactVite(subPath);
      results.push({
        name: entry.name,
        path: subPath,
        framework: isFastifyOrExpress ? 'generic' : 'generic',
        language: 'typescript',
      });
    } else if (hasRequirements || hasPyproject) {
      const isFastAPI = await detectFastAPI(subPath);
      results.push({
        name: entry.name,
        path: subPath,
        framework: isFastAPI ? 'fastapi' : 'generic',
        language: 'python',
      });
    }
  }

  return results;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectPrimaryLanguage(repoRoot: string): Promise<SupportedLanguage> {
  const { glob } = await import('glob');
  const counts: Record<string, number> = { typescript: 0, python: 0, go: 0, java: 0, rust: 0, ruby: 0 };

  const extMap: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'typescript',
    '.py': 'python',
    '.go': 'go',
    '.java': 'java',
    '.rs': 'rust',
    '.rb': 'ruby',
  };

  const files = await glob('**/*', { cwd: repoRoot, nodir: true, ignore: '**/node_modules/**' });
  for (const f of files) {
    const ext = path.extname(f);
    const lang = extMap[ext];
    if (lang) counts[lang]++;
  }

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return (sorted[0]?.[1] ?? 0) > 0 ? (sorted[0][0] as SupportedLanguage) : 'typescript';
}
