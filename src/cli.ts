#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { detectFramework } from './engine/framework-detector.js';
import { detectModules } from './engine/module-detector.js';
import { buildDependencyGraph, getDependencies } from './engine/graph-builder.js';
import { CacheManager } from './storage/cache-manager.js';
import { writeTeamWiki } from './storage/team-writer.js';
import { getCurrentCommit } from './utils/git-utils.js';
import { log } from './utils/logger.js';
import './engine/analyzers/index.js';

const command = process.argv[2];
const repoRoot = process.cwd();

async function init() {
  log.info('Initializing Code Wiki...');
  const start = Date.now();

  const { framework, language } = await detectFramework(repoRoot);
  log.info(`Detected: ${framework} (${language})`);

  const modules = await detectModules(repoRoot, framework, language);
  log.info(`Found ${modules.length} modules`);

  const graph = buildDependencyGraph(modules);
  const commit = await getCurrentCommit(repoRoot);

  // Initialize cache
  const cache = new CacheManager(repoRoot);
  await cache.init();
  await cache.cacheGraph(graph);

  // Generate overview
  const cachedOverview = await cache.getCachedOverview();
  const cachedTechStack = await cache.getCachedTechStack();

  const overview = {
    name: repoRoot.split('/').pop() ?? 'project',
    language,
    framework,
    architecture: modules.length > 1 ? 'multi-module' : 'single-module',
    modules: modules.map(m => ({
      name: m.name,
      path: m.path,
      responsibility: `${m.exports.length} exports`,
      keyFiles: m.files.length,
      deps: getDependencies(graph, m.name).internal,
    })),
    entryPoints: modules.filter(m => m.entryFile).map(m => m.path),
    sharedLibs: [],
    lastUpdated: new Date().toISOString(),
    overview: cachedOverview ?? undefined,
    techStack: cachedTechStack ?? undefined,
  };

  // Write team wiki (skeleton)
  const moduleWikis = modules.map(m => ({
    name: m.name,
    summary: `Run /wiki-update to generate detailed analysis`,
    readWhen: [`Working with ${m.name}`, `Understanding ${m.name} module`],
    responsibility: `Run /wiki-update to generate detailed analysis`,
    boundary: 'Pending LLM analysis',
    keyAbstractions: [],
    usagePatterns: [],
    invariants: [],
    configKeys: [],
    keyTypes: m.types.map(t => t.name),
    exports: m.exports.map(e => e.name),
    dependencies: getDependencies(graph, m.name),
    dependents: [],
    relatedModules: [],
    gotchas: [],
  }));

  const written = await writeTeamWiki(repoRoot, overview, moduleWikis, []);

  log.info(`Code Wiki initialized in ${Date.now() - start}ms`);
  log.info(`Written ${written.length} files to .code-wiki/team/`);
  console.log(`\nCode Wiki initialized!`);
  console.log(`  Modules: ${modules.length}`);
  console.log(`  Files written: ${written.length}`);
  console.log(`  Next: review .code-wiki/team/ and run /wiki-update to generate detailed content`);
}

async function update() {
  log.info('Updating Code Wiki...');
  const cache = new CacheManager(repoRoot);
  await cache.init();

  const manifest = await cache.getManifest();
  const stale = Object.keys(manifest.modules);
  log.info(`Checking ${stale.length} modules for updates...`);

  // Full update — re-init
  await init();
}

async function status() {
  const cache = new CacheManager(repoRoot);
  await cache.init();
  const manifest = await cache.getManifest();

  console.log('Code Wiki Status');
  console.log(`  Base commit: ${manifest.baseCommit || 'not set'}`);
  console.log(`  Last full build: ${manifest.lastFullBuild || 'never'}`);
  console.log(`  Cached modules: ${Object.keys(manifest.modules).length}`);

  for (const [name, entry] of Object.entries(manifest.modules)) {
    console.log(`    ${name}: ${entry.fileCount} files, analyzed ${entry.analyzedAt}`);
  }
}

async function serve() {
  // Import and run the server directly
  await import('./server.js');
}

async function installAdapter() {
  const projectDir = process.cwd();
  const claudeDir = path.join(projectDir, '.claude');

  // Locate adapter files relative to compiled dist/cli.js
  const distDir = path.dirname(fileURLToPath(import.meta.url));
  const adapterDir = path.resolve(distDir, '..', 'adapters', 'claude-code');

  // Verify adapter directory exists
  try {
    await fs.access(adapterDir);
  } catch {
    console.error(`Adapter files not found at ${adapterDir}`);
    console.error('Ensure code-wiki is installed correctly: npm install -g code-wiki');
    process.exit(1);
  }

  console.log('Installing Code Wiki adapter for Claude Code...');

  // Create target directories
  const skillDir = path.join(claudeDir, 'skills', 'wiki-context');
  const cmdDir = path.join(claudeDir, 'commands');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.mkdir(cmdDir, { recursive: true });

  // Copy skill
  await fs.copyFile(
    path.join(adapterDir, 'skills', 'wiki-context', 'SKILL.md'),
    path.join(skillDir, 'SKILL.md'),
  );

  // Copy commands
  const commands = ['wiki-init', 'wiki-update', 'wiki-query', 'wiki-verify'];
  for (const cmd of commands) {
    await fs.copyFile(
      path.join(adapterDir, 'commands', `${cmd}.md`),
      path.join(cmdDir, `${cmd}.md`),
    );
  }

  // Merge settings.json
  const settingsPath = path.join(claudeDir, 'settings.json');
  const adapterSettingsPath = path.join(adapterDir, 'settings.json');
  const adapterSettings = JSON.parse(await fs.readFile(adapterSettingsPath, 'utf-8'));

  let existing: Record<string, any> = {};
  try {
    existing = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    console.log('Existing settings.json found — merging MCP server config...');
  } catch {
    console.log('Creating .claude/settings.json...');
  }

  existing.mcpServers = { ...(existing.mcpServers || {}), ...(adapterSettings.mcpServers || {}) };
  const newPerms = adapterSettings.permissions?.allow || [];
  const existingAllow: string[] = existing.permissions?.allow || [];
  const mergedAllow = [...new Set([...existingAllow, ...newPerms])];
  existing.permissions = { ...(existing.permissions || {}), allow: mergedAllow };

  await fs.writeFile(settingsPath, JSON.stringify(existing, null, 2) + '\n');

  // Update .gitignore
  const gitignorePath = path.join(projectDir, '.gitignore');
  try {
    const gitignore = await fs.readFile(gitignorePath, 'utf-8');
    if (!gitignore.includes('.code-wiki/cache/')) {
      await fs.appendFile(gitignorePath, '\n.code-wiki/cache/\n');
      console.log('Added .code-wiki/cache/ to .gitignore');
    }
  } catch {
    await fs.writeFile(gitignorePath, '.code-wiki/cache/\n');
    console.log('Created .gitignore with .code-wiki/cache/');
  }

  console.log('');
  console.log('Installation complete!');
  console.log(`  Skills:   ${skillDir}`);
  console.log(`  Commands: ${cmdDir}`);
  console.log(`  Settings: ${settingsPath}`);
  console.log('');
  console.log('Next: restart Claude Code and run /wiki-init to initialize your project wiki.');
}

async function main() {
  switch (command) {
    case 'init':
      await init();
      break;
    case 'update':
      await update();
      break;
    case 'status':
      await status();
      break;
    case 'serve':
      await serve();
      break;
    case 'install':
      await installAdapter();
      break;
    default:
      console.log('Code Wiki — AI-powered codebase knowledge');
      console.log('');
      console.log('Usage: code-wiki <command>');
      console.log('');
      console.log('Commands:');
      console.log('  init     Initialize wiki for current project');
      console.log('  update   Update wiki (incremental)');
      console.log('  status   Show wiki status');
      console.log('  install  Install Claude Code adapter (skills, commands, settings)');
      console.log('  serve    Start MCP Server (stdio)');
  }
}

main().catch(err => {
  log.error('CLI failed', err);
  process.exit(1);
});
