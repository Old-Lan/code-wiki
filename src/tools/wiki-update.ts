import { z } from 'zod';
import path from 'node:path';
import type { ToolDefinition } from './registry.js';
import type { ModuleWiki, WikiUpdateResult } from '../types.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { buildDependencyGraph, getDependencies, getDependents } from '../engine/graph-builder.js';
import { CacheManager } from '../storage/cache-manager.js';
import { wikiPaths } from '../constants.js';
import { ensureDir, writeFile } from '../utils/file-utils.js';
import { getCurrentCommit, getChangedFiles } from '../utils/git-utils.js';
import { MODULE_SUMMARY_PROMPT } from '../prompts/templates.js';
import { log } from '../utils/logger.js';

export function createWikiUpdateTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_update',
    description: 'Update wiki content. Two modes: (1) scope="changed"|"full" returns analysis data for host LLM to generate content, (2) with module + generated_content persists LLM output to team wiki files.',
    schema: {
      scope: z.enum(['full', 'changed']).optional().default('changed'),
      paths: z.array(z.string()).optional(),
      module: z.string().optional(),
      generated_content: z.string().optional().describe('JSON string of ModuleWiki from host LLM'),
    },
    handler: async (params) => {
      const start = Date.now();
      const cache = new CacheManager(repoRoot);
      await cache.init();

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
      let modules = await detectModules(repoRoot, framework, language);

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

      const result: WikiUpdateResult = {
        status: 'analysis_ready',
        updatedModules: modules.map(m => m.name),
        instruction: 'For each module above, generate wiki content and call wiki_update again with { module: "<name>", generated_content: "<JSON>" }. The generated_content JSON must have: name, summary (one-liner for index), readWhen (array of "when to read" scenarios), responsibility (2-3 sentence narrative), boundary (what it does NOT cover), quickStart (optional: {description, codeExample, language} — minimal copy-paste example, omit for test/config modules), keyAbstractions (array of {name, kind, description} for 3-8 important symbols), usagePatterns (array of {title, description, codeExample?, language?} for 1-3 common patterns), invariants (array of hard constraints that must always hold), configKeys (array of {key, type, default?, description} — only if module has meaningful configuration), keyTypes (array), exports (array), dependencies ({internal:[],external:[]}), dependents (array), relatedModules (array of module names that interact), gotchas (array of {description, severity: "warning"|"caution"|"note"} — warning=causes bugs, caution=wastes debug time, note=non-obvious but harmless).',
        newEntries: [],
        removedEntries: [],
        cacheInvalidated: true,
        durationMs: Date.now() - start,
        analysisData: { modules: analysisData, graph },
        prompt,
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
