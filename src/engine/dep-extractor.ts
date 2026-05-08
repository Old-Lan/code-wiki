import type { SupportedLanguage, DependencyInfo, TechStack, Framework } from '../types.js';
import { readFile } from '../utils/file-utils.js';
import path from 'node:path';

const ROLE_TABLE: Record<string, DependencyInfo['role']> = {
  // Framework
  'next': 'framework', 'nuxt': 'framework', 'express': 'framework', 'fastify': 'framework',
  'fastapi': 'framework', 'django': 'framework', 'flask': 'framework', 'spring-boot': 'framework',
  'rails': 'framework', 'actix-web': 'framework', 'rocket': 'framework', 'gin': 'framework',
  'hono': 'framework', 'koa': 'framework', 'nest': 'framework',
  // UI
  'react': 'ui', 'react-dom': 'ui', 'vue': 'ui', '@angular/core': 'ui', 'svelte': 'ui',
  'antd': 'ui', '@ant-design': 'ui', 'tailwindcss': 'ui', '@mui': 'ui', 'chakra-ui': 'ui',
  'recharts': 'ui', 'chart.js': 'ui', 'd3': 'ui',
  // Database
  'prisma': 'database', 'typeorm': 'database', 'mongoose': 'database', 'sequelize': 'database',
  'sqlalchemy': 'database', 'pymongo': 'database', 'psycopg2': 'database', 'pymysql': 'database',
  'redis': 'database', 'ioredis': 'database', 'drizzle-orm': 'database',
  // Testing
  'jest': 'testing', 'vitest': 'testing', 'pytest': 'testing', 'mocha': 'testing',
  'cypress': 'testing', 'playwright': 'testing', '@testing-library': 'testing',
  'junit': 'testing', 'rspec': 'testing',
  // Build
  'webpack': 'build', 'vite': 'build', 'rollup': 'build', 'esbuild': 'build',
  'typescript': 'build', 'tsup': 'build', 'turbo': 'build', '@swc': 'build',
  // Core
  'zod': 'core', 'axios': 'core', 'fetch': 'core', 'langchain': 'core',
  'polars': 'core', 'lightgbm': 'core', 'tensorflow': 'core', 'torch': 'core',
  'pandas': 'core', 'numpy': 'core', 'scikit-learn': 'core',
};

function classifyRole(name: string): DependencyInfo['role'] {
  const lower = name.toLowerCase();
  for (const [key, role] of Object.entries(ROLE_TABLE)) {
    if (lower === key || lower.startsWith(key + '/') || lower.startsWith('@' + key)) {
      return role;
    }
  }
  return 'other';
}

async function readManifest(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export async function extractDependencies(
  repoRoot: string,
  language: SupportedLanguage,
  framework?: Framework,
): Promise<TechStack> {
  switch (language) {
    case 'typescript':
      return extractFromPackageJson(repoRoot, language, framework);
    case 'python':
      return extractFromPython(repoRoot, language, framework);
    case 'go':
      return extractFromGoMod(repoRoot, language, framework);
    case 'java':
      return extractFromPomXml(repoRoot, language, framework);
    case 'rust':
      return extractFromCargoToml(repoRoot, language, framework);
    case 'ruby':
      return extractFromGemfile(repoRoot, language, framework);
    default:
      return { language, framework: framework ?? 'generic', dependencies: [] };
  }
}

async function extractFromPackageJson(
  repoRoot: string,
  language: SupportedLanguage,
  framework?: Framework,
): Promise<TechStack> {
  const raw = await readManifest(path.join(repoRoot, 'package.json'));
  if (!raw) return { language, framework: framework ?? 'generic', dependencies: [] };

  const pkg = JSON.parse(raw);
  const deps: DependencyInfo[] = [];

  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    deps.push({
      name,
      version: String(version).replace(/^[\^~>=<]*/, ''),
      role: classifyRole(name),
    });
  }

  for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
    deps.push({
      name,
      version: String(version).replace(/^[\^~>=<]*/, ''),
      role: classifyRole(name),
    });
  }

  const engines = pkg.engines ?? {};
  const nodeVersion = engines.node?.replace(/^[\^~>=<]*/, '');

  return {
    language,
    languageVersion: 'ES2022',
    framework: framework ?? 'generic',
    runtime: nodeVersion ? `Node.js ${nodeVersion}` : undefined,
    packageManager: 'npm',
    dependencies: deps,
  };
}

async function extractFromPython(
  repoRoot: string,
  language: SupportedLanguage,
  framework?: Framework,
): Promise<TechStack> {
  const deps: DependencyInfo[] = [];
  const raw = await readManifest(path.join(repoRoot, 'pyproject.toml'));
  if (!raw) return { language, framework: framework ?? 'generic', dependencies: deps };

  const requiresPython = raw.match(/requires-python\s*=\s*"([^"]+)"/)?.[1];
  const depBlock = raw.match(/\[project\.dependencies\]([\s\S]*?)(\[|$)/)?.[1] ?? '';
  for (const line of depBlock.split('\n')) {
    const m = line.trim().match(/^([a-zA-Z0-9_.-]+)\s*([><=!~]+\s*[\d.]+)?/);
    if (m) {
      deps.push({
        name: m[1],
        version: m[2]?.replace(/[><=!~\s]+/, '') ?? '*',
        role: classifyRole(m[1]),
      });
    }
  }
  return {
    language,
    languageVersion: requiresPython ?? undefined,
    framework: framework ?? 'generic',
    packageManager: 'pip',
    dependencies: deps,
  };
}

async function extractFromGoMod(
  repoRoot: string,
  language: SupportedLanguage,
  framework?: Framework,
): Promise<TechStack> {
  const deps: DependencyInfo[] = [];
  const raw = await readManifest(path.join(repoRoot, 'go.mod'));
  if (!raw) return { language, framework: framework ?? 'generic', dependencies: deps };

  for (const line of raw.split('\n')) {
    const m = line.trim().match(/^([a-zA-Z0-9./-]+)\s+(v[\d.]+)/);
    if (m && !m[1].startsWith('module ') && !m[1].startsWith('go ')) {
      deps.push({
        name: m[1],
        version: m[2],
        role: classifyRole(m[1]),
      });
    }
  }
  return { language, framework: framework ?? 'generic', dependencies: deps };
}

async function extractFromPomXml(
  repoRoot: string,
  language: SupportedLanguage,
  framework?: Framework,
): Promise<TechStack> {
  const deps: DependencyInfo[] = [];
  const raw = await readManifest(path.join(repoRoot, 'pom.xml'));
  if (!raw) return { language, framework: framework ?? 'generic', dependencies: deps };

  const re = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>(?:\s*<version>([^<]+)<\/version>)?/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    deps.push({
      name: `${m[1]}:${m[2]}`,
      version: m[3] ?? '*',
      role: classifyRole(m[2]),
    });
  }
  return { language, framework: framework ?? 'generic', dependencies: deps };
}

async function extractFromCargoToml(
  repoRoot: string,
  language: SupportedLanguage,
  framework?: Framework,
): Promise<TechStack> {
  const deps: DependencyInfo[] = [];
  const raw = await readManifest(path.join(repoRoot, 'Cargo.toml'));
  if (!raw) return { language, framework: framework ?? 'generic', dependencies: deps };

  const inDeps = raw.match(/\[dependencies\]([\s\S]*?)(\[|$)/)?.[1] ?? '';
  for (const line of inDeps.split('\n')) {
    const m = line.trim().match(/^([a-zA-Z0-9_-]+)\s*[=\s]?\s*(?:version\s*=\s*)?"([^"]*)"?/);
    if (m) {
      deps.push({
        name: m[1],
        version: m[2] || '*',
        role: classifyRole(m[1]),
      });
    }
  }
  return { language, framework: framework ?? 'generic', dependencies: deps };
}

async function extractFromGemfile(
  repoRoot: string,
  language: SupportedLanguage,
  framework?: Framework,
): Promise<TechStack> {
  const deps: DependencyInfo[] = [];
  const raw = await readManifest(path.join(repoRoot, 'Gemfile'));
  if (!raw) return { language, framework: framework ?? 'generic', dependencies: deps };

  for (const line of raw.split('\n')) {
    const m = line.trim().match(/^gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/);
    if (m) {
      deps.push({
        name: m[1],
        version: m[2] ?? '*',
        role: classifyRole(m[1]),
      });
    }
  }
  return { language, framework: framework ?? 'generic', dependencies: deps };
}
