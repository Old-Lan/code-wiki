import { z } from 'zod';
import path from 'node:path';
import type { ToolDefinition } from './registry.js';
import type { ModuleWiki, WikiUpdateResult, ProjectOverview } from '../types.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { buildDependencyGraph, getDependencies, getDependents } from '../engine/graph-builder.js';
import { CacheManager } from '../storage/cache-manager.js';
import { wikiPaths } from '../constants.js';
import { ensureDir, writeFile } from '../utils/file-utils.js';
import { getCurrentCommit, getChangedFiles } from '../utils/git-utils.js';
import { MODULE_SUMMARY_PROMPT, PROJECT_OVERVIEW_PROMPT, TECH_STACK_DESCRIPTION_PROMPT, MODULE_DETECTION_PROMPT } from '../prompts/templates.js';
import { extractDependencies } from '../engine/dep-extractor.js';
import { log } from '../utils/logger.js';
import type { ModuleGrouping } from '../types.js';

export function createWikiUpdateTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_update',
    description: 'Update wiki content via two-phase MCP workflow. Phase 1: call with scope="changed"|"full" to get AST analysis data, then generate wiki content as the host LLM. Phase 2: call with module + generated_content to persist. IMPORTANT: Do NOT use `npx code-wiki update` or any Bash/CLI command. The two-phase pattern ensures wiki content is LLM-generated for higher quality.',
    schema: {
      scope: z.enum(['full', 'changed']).optional().default('changed'),
      paths: z.array(z.string()).optional(),
      module: z.string().optional(),
      generated_content: z.string().optional().describe('JSON string of ModuleWiki from host LLM'),
      persist_overview: z.string().optional().describe('JSON string of ProjectOverview from host LLM'),
      persist_tech_stack_descriptions: z.string().optional().describe('JSON object mapping package name to description'),
      module_grouping: z.string().optional().describe('JSON string from LLM module detection. Provided to cache grouping before analysis.'),
    },
    handler: async (params) => {
      const start = Date.now();
      const cache = new CacheManager(repoRoot);
      await cache.init();

      // Handle module_grouping caching
      if (params.module_grouping && !params.module && !params.generated_content && !params.persist_overview && !params.persist_tech_stack_descriptions) {
        const parsedGrouping = JSON.parse(params.module_grouping);
        const fw = await detectFramework(repoRoot);
        const grouping: ModuleGrouping = {
          ...parsedGrouping,
          detectedAt: new Date().toISOString(),
          language: fw.language,
          framework: fw.framework,
          fileCount: parsedGrouping.modules.reduce((sum: number, m: { files: string[] }) => sum + m.files.length, 0),
        };
        await cache.cacheGrouping(grouping);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ status: 'grouping_cached', moduleCount: grouping.modules.length }) }],
        };
      }

      // Check for cached grouping; if none, return detection prompt
      const cachedGrouping = await cache.getCachedGrouping();
      if (!cachedGrouping && !params.module && !params.generated_content && !params.persist_overview && !params.persist_tech_stack_descriptions) {
        const { findSourceFiles } = await import('../utils/file-utils.js');
        const sourceFiles = await findSourceFiles(repoRoot);
        const { buildDirectoryTree, buildSimpleImportGraph } = await import('./wiki-init.js');
        const fw = await detectFramework(repoRoot);

        const dirTree = buildDirectoryTree(sourceFiles);
        const importGraph = await buildSimpleImportGraph(repoRoot, sourceFiles);

        const prompt = MODULE_DETECTION_PROMPT
          .replace('{{language}}', fw.language)
          .replace('{{framework}}', fw.framework)
          .replace('{{fileTree}}', dirTree)
          .replace('{{importGraph}}', JSON.stringify(importGraph, null, 2));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'detection_required',
              fileCount: sourceFiles.length,
              language: fw.language,
              framework: fw.framework,
              instruction: 'No module grouping found. Review the file tree and determine module grouping. Then call wiki_update with { module_grouping: "<JSON>" } to cache the grouping, then call again with { scope: "changed" } to proceed.',
              prompt,
            }, null, 2),
          }],
        };
      }

      // Persist overview content
      if (params.persist_overview && !params.module && !params.generated_content) {
        const overviewContent: ProjectOverview = JSON.parse(params.persist_overview);
        await cache.cacheOverview(overviewContent);

        // Re-render README and architecture with new overview
        const { framework, language } = await detectFramework(repoRoot);
        const allModules = await detectModules(repoRoot, framework, language);
        const graph = await cache.getCachedGraph() ?? buildDependencyGraph(allModules);
        const cachedTechStack = await cache.getCachedTechStack();
        const existingModuleWikis: ModuleWiki[] = [];
        for (const m of allModules) {
          const cached = await cache.getCachedModule(m.name);
          if (cached) existingModuleWikis.push(cached);
        }

        const overviewWiki = {
          name: repoRoot.split('/').pop() ?? 'project',
          language, framework,
          architecture: allModules.length > 1 ? 'multi-module' : 'single-module',
          modules: allModules.map(m => ({
            name: m.name, path: m.path,
            responsibility: `${m.exports.length} exports`,
            keyFiles: m.files.length,
            deps: getDependencies(graph, m.name).internal,
          })),
          entryPoints: allModules.filter(m => m.entryFile).map(m => m.path),
          sharedLibs: [],
          lastUpdated: new Date().toISOString(),
          overview: overviewContent,
          techStack: cachedTechStack ?? undefined,
        };

        const { writeTeamWiki } = await import('../storage/team-writer.js');
        await writeTeamWiki(repoRoot, overviewWiki, existingModuleWikis, []);

        log.info('wiki_update persisted project overview');
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'overview_persisted' }) }],
        };
      }

      // Persist tech stack descriptions
      if (params.persist_tech_stack_descriptions && !params.module && !params.generated_content) {
        const descriptions: Record<string, string> = JSON.parse(params.persist_tech_stack_descriptions);
        const existingTechStack = await cache.getCachedTechStack();
        if (existingTechStack) {
          existingTechStack.dependencies = existingTechStack.dependencies.map(d => ({
            ...d,
            description: descriptions[d.name] ?? d.description,
          }));
          await cache.cacheTechStack(existingTechStack);

          // Re-render README and architecture
          const { framework, language } = await detectFramework(repoRoot);
          const allModules = await detectModules(repoRoot, framework, language);
          const graph = await cache.getCachedGraph() ?? buildDependencyGraph(allModules);
          const cachedOverview = await cache.getCachedOverview();
          const existingModuleWikis: ModuleWiki[] = [];
          for (const m of allModules) {
            const cached = await cache.getCachedModule(m.name);
            if (cached) existingModuleWikis.push(cached);
          }

          const overviewWiki = {
            name: repoRoot.split('/').pop() ?? 'project',
            language, framework,
            architecture: allModules.length > 1 ? 'multi-module' : 'single-module',
            modules: allModules.map(m => ({
              name: m.name, path: m.path,
              responsibility: `${m.exports.length} exports`,
              keyFiles: m.files.length,
              deps: getDependencies(graph, m.name).internal,
            })),
            entryPoints: allModules.filter(m => m.entryFile).map(m => m.path),
            sharedLibs: [],
            lastUpdated: new Date().toISOString(),
            overview: cachedOverview ?? undefined,
            techStack: existingTechStack,
          };

          const { writeTeamWiki } = await import('../storage/team-writer.js');
          await writeTeamWiki(repoRoot, overviewWiki, existingModuleWikis, []);
        }

        log.info('wiki_update persisted tech stack descriptions');
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'tech_stack_persisted' }) }],
        };
      }

      // Mode 2: Persist generated content to both cache AND team wiki
      if (params.module && params.generated_content) {
        const wiki: ModuleWiki = JSON.parse(params.generated_content);
        await cache.cacheModule(params.module, wiki, []);

        const paths = wikiPaths(repoRoot);
        await ensureDir(path.join(paths.team, 'modules'));
        const modPath = path.join(paths.team, 'modules', `${params.module}.md`);
        await writeFile(modPath, renderModuleMd(wiki));

        log.info(`wiki_update persisted content for ${params.module}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'content_persisted',
              module: params.module,
              file: modPath,
            }),
          }],
        };
      }

      // Mode 1: Analyze and return data for host LLM
      const { framework, language } = await detectFramework(repoRoot);
      let modules = cachedGrouping
        ? await buildModulesFromGrouping(repoRoot, cachedGrouping, language)
        : await detectModules(repoRoot, framework, language);

      // Filter to changed modules if scope="changed"
      if (params.scope === 'changed' && !params.paths) {
        const changedFiles = await getChangedFiles(repoRoot);
        const changedModules = new Set(
          changedFiles.map(f => {
            const mod = modules.find(m => m.files.includes(f) || f.startsWith(m.path));
            return mod?.name;
          }).filter(Boolean) as string[]
        );
        modules = modules.filter(m => changedModules.has(m.name));
      } else if (params.paths) {
        modules = modules.filter(m => params.paths!.some((p: string) => m.path.startsWith(p)));
      }

      if (modules.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'no_changes',
              updatedModules: [],
            }),
          }],
        };
      }

      const graph = await cache.getCachedGraph() ?? buildDependencyGraph(modules);
      const analysisData = modules.map(m => {
        const deps = getDependencies(graph, m.name);
        const dependents = getDependents(graph, m.name);
        return {
          module: m.name,
          path: m.path,
          fileCount: m.files.length,
          topExports: m.exports.slice(0, 30).map(e => `${e.name} (${e.kind})`),
          topTypes: m.types.slice(0, 20).map(t => t.name),
          topFunctions: m.functions.slice(0, 20).map(f => f.name),
          internalDeps: deps.internal,
          externalDeps: deps.external.slice(0, 30),
          dependents,
        };
      });

      const prompt = MODULE_SUMMARY_PROMPT
        .replace('{{astData}}', JSON.stringify(analysisData))
        .replace('{{depData}}', JSON.stringify(graph));

      // Extract tech stack and build overview prompt
      const techStackData = await extractDependencies(repoRoot, language);
      const overviewPrompt = PROJECT_OVERVIEW_PROMPT
        .replace('{{moduleData}}', JSON.stringify(analysisData))
        .replace('{{depData}}', JSON.stringify(techStackData))
        .replace('{{entryPoints}}', JSON.stringify(
          modules.filter(m => m.entryFile).map(m => ({ name: m.name, path: m.entryFile }))
        ));

      const result: WikiUpdateResult = {
        status: 'analysis_ready',
        updatedModules: modules.map(m => m.name),
        instruction: 'For each module above, generate wiki content and call wiki_update again with { module: "<name>", generated_content: "<JSON>" }. The generated_content JSON must have: name, summary (one-liner for index), readWhen (array of "when to read" scenarios), responsibility (2-3 sentence narrative), boundary (what it does NOT cover), quickStart (optional: {description, codeExample, language} — minimal copy-paste example, omit for test/config modules), keyAbstractions (array of {name, kind, description} for 3-8 important symbols), usagePatterns (array of {title, description, codeExample?, language?} for 1-3 common patterns), invariants (array of hard constraints that must always hold), configKeys (array of {key, type, default?, description} — only if module has meaningful configuration), keyTypes (array), exports (array), dependencies ({internal:[],external:[]}), dependents (array), relatedModules (array of module names that interact), gotchas (array of {description, severity: "warning"|"caution"|"note"} — warning=causes bugs, caution=wastes debug time, note=non-obvious but harmless).\n\nAfter generating module content, also generate project overview using the overviewPrompt below and call wiki_update with { persist_overview: "<JSON>" } to persist it. The overview JSON must have: summary (1-2 sentence elevator pitch), businessContext (2-3 sentences), coreCapabilities (3-6 bullet points), targetUsers (who uses this).\n\nOptionally, generate tech stack descriptions using techStackData and call wiki_update with { persist_tech_stack_descriptions: "<JSON>" } where JSON is { "package-name": "brief description" }.',
        newEntries: [],
        removedEntries: [],
        cacheInvalidated: true,
        durationMs: Date.now() - start,
        analysisData: { modules: analysisData, graph },
        prompt,
        overviewPrompt,
        techStackData,
      };

      log.info(`wiki_update analyzed ${modules.length} modules in ${Date.now() - start}ms`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  };
}

function renderModuleMd(m: ModuleWiki): string {
  const readWhenSection = (m.readWhen ?? []).length > 0
    ? (m.readWhen ?? []).map((r: string) => `  - ${r}`).join('\n')
    : '  - Working with this module';

  const quickStartSection = m.quickStart
    ? `\n## Quick Start\n\n${m.quickStart.description}\n\n\`\`\`${m.quickStart.language ?? 'typescript'}\n${m.quickStart.codeExample}\n\`\`\`\n`
    : '';

  const abstractionRows = (m.keyAbstractions ?? []).length > 0
    ? (m.keyAbstractions ?? []).map((a: { name: string; kind: string; description: string }) =>
        `| \`${a.name}\` | ${a.kind} | ${a.description} |`
      ).join('\n')
    : '| — | — | No key abstractions identified |';

  const patternsSection = (m.usagePatterns ?? []).length > 0
    ? (m.usagePatterns ?? []).map((p: { title: string; description: string; codeExample?: string; language?: string }) => {
        const codeBlock = p.codeExample
          ? `\n\n\`\`\`${p.language ?? 'typescript'}\n${p.codeExample}\n\`\`\``
          : '';
        return `### ${p.title}\n\n${p.description}${codeBlock}`;
      }).join('\n\n')
    : 'No common patterns documented yet.';

  const invariantsSection = (m.invariants ?? []).length > 0
    ? `\n## Invariants\n\n${(m.invariants ?? []).map((i: string) => `- ${i}`).join('\n')}\n`
    : '';

  const configSection = (m.configKeys ?? []).length > 0
    ? `\n## Configuration\n\n| Key | Type | Default | Description |\n| --- | ---- | ------- | ----------- |\n${(m.configKeys ?? []).map((c: { key: string; type: string; default?: string; description: string }) => `| \`${c.key}\` | ${c.type} | ${c.default ?? '—'} | ${c.description} |`).join('\n')}\n`
    : '';

  const relatedSection = (m.relatedModules ?? []).length > 0
    ? (m.relatedModules ?? []).map((rm: string) => `- [${rm}](../modules/${rm}.md)`).join('\n')
    : 'None';

  const gotchasSection = (m.gotchas ?? []).length > 0
    ? (m.gotchas ?? []).map((g: { description: string; severity: string } | string) => {
        const gotcha = typeof g === 'string' ? { description: g, severity: 'note' } : g;
        const label = gotcha.severity === 'warning' ? '**Warning:**' : gotcha.severity === 'caution' ? '**Caution:**' : '**Note:**';
        return `- ${label} ${gotcha.description}`;
      }).join('\n')
    : 'None recorded';

  const summary = m.summary ?? m.responsibility.split('.')[0] ?? m.name;

  return `---
summary: "${summary.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
read_when:
${readWhenSection}
title: "${m.name}"
---

# ${m.name}

> Generated: ${new Date().toISOString()}

## Overview

${m.responsibility}

## Boundary

${m.boundary}
${quickStartSection}
## Key Abstractions

| Symbol | Kind | Description |
| ------ | ---- | ----------- |
${abstractionRows}

## Usage Patterns

${patternsSection}
${invariantsSection}${configSection}
## Exports

${m.exports.length > 0 ? m.exports.map(e => `- \`${e}\``).join('\n') : 'None'}

## Key Types

${m.keyTypes.length > 0 ? m.keyTypes.map(t => `- \`${t}\``).join('\n') : 'None'}

## Dependencies

**Internal:** ${m.dependencies.internal.length > 0 ? m.dependencies.internal.map(d => `[${d}](../modules/${d}.md)`).join(', ') : 'None'}

**External:** ${m.dependencies.external.length > 0 ? m.dependencies.external.map(d => `\`${d}\``).join(', ') : 'None'}

## Dependents

${m.dependents.length > 0 ? m.dependents.map(d => `- [${d}](../modules/${d}.md)`).join('\n') : 'None'}

## Gotchas

${gotchasSection}

## Related

${relatedSection}
`;
}

async function buildModulesFromGrouping(repoRoot: string, grouping: ModuleGrouping, language: string) {
  const { buildModuleDefs } = await import('../engine/module-detector.js');
  const moduleMap = new Map(grouping.modules.map(m => [m.name, m.files]));
  return buildModuleDefs(repoRoot, moduleMap, language as any);
}
