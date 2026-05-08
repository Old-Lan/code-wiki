import type { ModuleWiki, OverviewWiki, FlowDef } from '../types.js';
import { ensureDir, writeFile } from '../utils/file-utils.js';
import { wikiPaths } from '../constants.js';
import path from 'node:path';

export async function writeTeamWiki(
  repoRoot: string,
  overview: OverviewWiki,
  moduleWikis: ModuleWiki[],
  flows: FlowDef[],
): Promise<string[]> {
  const paths = wikiPaths(repoRoot);
  const written: string[] = [];

  await ensureDir(paths.team);
  await ensureDir(path.join(paths.team, 'modules'));
  await ensureDir(path.join(paths.team, 'flows'));

  // Architecture overview
  const archPath = path.join(paths.team, 'architecture.md');
  await writeFile(archPath, renderArchitectureMd(overview));
  written.push(archPath);

  // Module docs
  for (const mod of moduleWikis) {
    const modPath = path.join(paths.team, 'modules', `${mod.name}.md`);
    await writeFile(modPath, renderModuleMd(mod, overview.lastUpdated, overview.modules));
    written.push(modPath);
  }

  // Flow docs
  for (const flow of flows) {
    const flowPath = path.join(paths.team, 'flows', `${flow.name}.md`);
    await writeFile(flowPath, renderFlowMd(flow, overview.lastUpdated));
    written.push(flowPath);
  }

  // Gotchas (aggregated from all modules)
  const allGotchas = moduleWikis.flatMap(m =>
    m.gotchas.map(g => ({
      module: m.name,
      description: typeof g === 'string' ? g : g.description,
      severity: typeof g === 'string' ? 'note' as const : g.severity,
    }))
  );
  if (allGotchas.length > 0) {
    const gotchasPath = path.join(paths.team, 'gotchas.md');
    await writeFile(gotchasPath, renderGotchasMd(allGotchas, overview.lastUpdated));
    written.push(gotchasPath);
  }

  // Index
  const indexPath = path.join(paths.team, 'README.md');
  await writeFile(indexPath, renderIndexMd(overview, moduleWikis));
  written.push(indexPath);

  return written;
}

function renderArchitectureMd(o: OverviewWiki): string {
  const moduleMap = o.modules.map(m => m.name);

  const overviewSection = o.overview
    ? `
### Business Context

${o.overview.businessContext}

### Core Capabilities

${o.overview.coreCapabilities.map(c => `- ${c}`).join('\n')}
`
    : '';

  const techStackSection = o.techStack
    ? `
## Tech Stack

| Category | Key Technologies |
| -------- | ---------------- |
| Language | ${o.techStack.language}${o.techStack.languageVersion ? ` (${o.techStack.languageVersion})` : ''} |
| Framework | ${o.techStack.framework} |
${o.techStack.runtime ? `| Runtime | ${o.techStack.runtime} |` : ''}
${o.techStack.packageManager ? `| Package Manager | ${o.techStack.packageManager} |` : ''}
| Direct Dependencies | ${o.techStack.dependencies.length} |
`
    : '';

  return `---
summary: "${o.name} architecture overview, module layout, and dependency direction"
read_when:
  - Understanding how modules relate to each other
  - Onboarding to the project structure
  - Planning cross-module changes
title: "Architecture"
---

# Architecture Overview

> Generated: ${o.lastUpdated}

## Overview

${o.name} is a **${o.language}** project using the **${o.framework}** framework. The codebase follows a **${o.architecture}** architecture.
${overviewSection}
## Modules

${o.modules.map(m => `- **[${m.name}](modules/${m.name}.md)** — ${m.responsibility}`).join('\n')}

## Dependency Direction

\`\`\`mermaid
graph TD
${renderMermaidModules(o.modules)}
\`\`\`

## Entry Points

${o.entryPoints.map(p => `- \`${p}\``).join('\n')}

## Shared Libraries

${o.sharedLibs.length > 0 ? o.sharedLibs.map(l => `- \`${l}\``).join('\n') : 'None'}
${techStackSection}
## Related

- [Module Index](#modules) — individual module documentation
- [Gotchas](gotchas.md) — aggregated pitfalls across all modules
`;
}

function renderMermaidModules(modules: Array<{ name: string; deps: string[] }>): string {
  const lines: string[] = [];
  for (const mod of modules) {
    if (mod.deps.length === 0) {
      lines.push(`  ${safeMermaidId(mod.name)}["${mod.name}"]`);
    }
    for (const dep of mod.deps) {
      lines.push(`  ${safeMermaidId(mod.name)}["${mod.name}"] --> ${safeMermaidId(dep)}["${dep}"]`);
    }
  }
  return [...new Set(lines)].join('\n');
}

function safeMermaidId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

function renderModuleMd(m: ModuleWiki, date: string, allModules?: Array<{ name: string; path: string }>): string {
  const readWhenSection = m.readWhen.length > 0
    ? m.readWhen.map(r => `  - ${r}`).join('\n')
    : '  - Working with this module';

  const quickStartSection = m.quickStart
    ? `## Quick Start

${m.quickStart.description}

\`\`\`${m.quickStart.language ?? 'typescript'}
${m.quickStart.codeExample}
\`\`\`
`
    : '';

  const abstractionRows = (m.keyAbstractions ?? []).length > 0
    ? (m.keyAbstractions ?? []).map(a =>
        `| \`${a.name}\` | ${a.kind} | ${a.description} |`
      ).join('\n')
    : '| — | — | No key abstractions identified |';

  const patternsSection = (m.usagePatterns ?? []).length > 0
    ? (m.usagePatterns ?? []).map(p => {
        const codeBlock = p.codeExample
          ? `\n\n\`\`\`${p.language ?? 'typescript'}\n${p.codeExample}\n\`\`\``
          : '';
        return `### ${p.title}

${p.description}${codeBlock}`;
      }).join('\n\n')
    : 'No common patterns documented yet.';

  const invariantsSection = (m.invariants ?? []).length > 0
    ? `## Invariants

${(m.invariants ?? []).map(i => `- ${i}`).join('\n')}
`
    : '';

  const configSection = (m.configKeys ?? []).length > 0
    ? `## Configuration

| Key | Type | Default | Description |
| --- | ---- | ------- | ----------- |
${(m.configKeys ?? []).map(c => `| \`${c.key}\` | ${c.type} | ${c.default ?? '—'} | ${c.description} |`).join('\n')}
`
    : '';

  const relatedSection = (m.relatedModules ?? []).length > 0
    ? (m.relatedModules ?? []).map(rm => {
        const moduleFile = allModules?.find(am => am.name === rm);
        return moduleFile ? `- [${rm}](../modules/${rm}.md)` : `- ${rm}`;
      }).join('\n')
    : 'None';

  const internalDeps = m.dependencies.internal.length > 0
    ? m.dependencies.internal.map(d => {
        const moduleFile = allModules?.find(am => am.name === d);
        return moduleFile ? `- [${d}](../modules/${d}.md)` : `- ${d}`;
      }).join('\n')
    : 'None';

  const externalDeps = m.dependencies.external.length > 0
    ? m.dependencies.external.map(d => `- \`${d}\``).join('\n')
    : 'None';

  const dependentsList = m.dependents.length > 0
    ? m.dependents.map(d => {
        const moduleFile = allModules?.find(am => am.name === d);
        return moduleFile ? `- [${d}](../modules/${d}.md)` : `- ${d}`;
      }).join('\n')
    : 'None';

  const gotchasSection = (m.gotchas ?? []).length > 0
    ? (m.gotchas ?? []).map(g => {
        const gotcha = typeof g === 'string' ? { description: g, severity: 'note' as const } : g;
        const label = gotcha.severity === 'warning' ? '**Warning:**' : gotcha.severity === 'caution' ? '**Caution:**' : '**Note:**';
        return `- ${label} ${gotcha.description}`;
      }).join('\n')
    : 'None recorded';

  return `---
summary: "${escapeYaml(m.summary)}"
read_when:
${readWhenSection}
title: "${escapeYaml(m.name)}"
---

# ${m.name}

> Generated: ${date}

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

**Internal:**

${internalDeps}

**External:**

${externalDeps}

## Dependents

${dependentsList}

## Gotchas

${gotchasSection}

## Related

${relatedSection}
`;
}

function renderFlowMd(f: FlowDef, date: string): string {
  const stepsSection = f.steps.map(s =>
    `${s.order}. **${s.action}** — \`${s.file}:${s.line}\` (\`${s.function}()\`)`
  ).join('\n');

  const errorSection = f.errorPaths.length > 0
    ? `\n## Error Paths\n\n${f.errorPaths.map(e =>
        `- **If ${e.condition}:** → step ${e.gotoStep} (\`${e.file}:${e.line}\`)`
      ).join('\n')}`
    : '';

  const relatedSection = f.relatedModules.length > 0
    ? `\n## Related Modules\n\n${f.relatedModules.map(rm => `- [${rm}](../modules/${rm}.md)`).join('\n')}`
    : '';

  const mermaidSection = `\n## Sequence\n\n\`\`\`mermaid\nsequenceDiagram\n${f.steps.map((s, i) => {
    const next = f.steps[i + 1];
    if (next) {
      return `    Step${s.order}->>Step${next.order}: ${next.action}`;
    }
    return `    Note over Step${s.order}: ${s.action} (end)`;
  }).join('\n')}\n\`\`\``;

  return `---
summary: "${escapeYaml(f.description)}"
read_when:
  - Tracing the ${f.name} flow
  - Debugging issues with ${f.name}
title: "${escapeYaml(f.name)}"
---

# ${f.name}

> Generated: ${date}

## Overview

${f.description}

## Trigger

${f.trigger}

## Steps

${stepsSection}
${mermaidSection}${errorSection}${relatedSection}
`;
}

function renderGotchasMd(gotchas: Array<{ module: string; description: string; severity: 'warning' | 'caution' | 'note' }>, date: string): string {
  const warnings = gotchas.filter(g => g.severity === 'warning');
  const cautions = gotchas.filter(g => g.severity === 'caution');
  const notes = gotchas.filter(g => g.severity === 'note');

  const renderGroup = (title: string, items: typeof gotchas) =>
    items.length > 0
      ? `### ${title}\n\n${items.map(g => `- **[${g.module}]** ${g.description}`).join('\n')}\n`
      : '';

  return `---
summary: "Aggregated non-obvious pitfalls across all modules"
read_when:
  - Before making changes to unfamiliar modules
  - Debugging unexpected behavior
title: "Gotchas"
---

# Gotchas

> Generated: ${date}

${renderGroup('Warnings (will cause bugs/data loss)', warnings)}${renderGroup('Cautions (subtle behavior, wastes debugging time)', cautions)}${renderGroup('Notes (non-obvious but harmless)', notes)}`;
}

function renderIndexMd(o: OverviewWiki, modules: ModuleWiki[]): string {
  const overviewSection = o.overview
    ? `## Project Overview

${o.overview.summary}

${o.overview.businessContext}

### Core Capabilities

${o.overview.coreCapabilities.map(c => `- ${c}`).join('\n')}

### Target Users

${o.overview.targetUsers}
`
    : `## Project Overview

_Run [/wiki-update](commands/wiki-update.md) to generate project overview._
`;

  const techStackSection = o.techStack
    ? `## Tech Stack

| Category | Key Technologies |
| -------- | ---------------- |
| Language | ${o.techStack.language}${o.techStack.languageVersion ? ` (${o.techStack.languageVersion})` : ''} |
| Framework | ${o.techStack.framework} |
${o.techStack.runtime ? `| Runtime | ${o.techStack.runtime} |` : ''}
${o.techStack.packageManager ? `| Package Manager | ${o.techStack.packageManager} |` : ''}

${renderTechStackTable(o.techStack)}
`
    : `## Tech Stack

_Run [/wiki-update](commands/wiki-update.md) to generate tech stack details._
`;

  return `---
summary: "${o.name} auto-generated project documentation"
read_when:
  - Onboarding to the project
  - Looking up module responsibilities
title: "Code Wiki"
---

# Code Wiki

> Auto-generated project documentation

${overviewSection}
${techStackSection}
## Architecture

See [architecture.md](architecture.md) for the full architecture overview with dependency diagram.

## Modules

| Module | Summary |
| ------ | ------- |
${modules.map(m => `| [${m.name}](modules/${m.name}.md) | ${m.summary} |`).join('\n')}

## Flows

See [flows/](flows/) for business flow documentation.

## Gotchas

See [gotchas.md](gotchas.md) for aggregated pitfalls.

## Quick Stats

- **Modules:** ${o.modules.length}
- **Entry Points:** ${o.entryPoints.length}
- **Last Updated:** ${o.lastUpdated}
`;
}

function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

const ROLE_ORDER = ['framework', 'core', 'ui', 'database', 'build', 'testing', 'utility', 'other'] as const;
const ROLE_LABELS: Record<string, string> = {
  framework: 'Framework & Runtime',
  core: 'Core Libraries',
  ui: 'UI & Frontend',
  database: 'Database & Storage',
  testing: 'Testing',
  build: 'Build & Tooling',
  utility: 'Utilities',
  other: 'Other',
};

function renderTechStackTable(ts: import('../types.js').TechStack): string {
  const groups: Record<string, import('../types.js').DependencyInfo[]> = {};
  for (const dep of ts.dependencies) {
    const group = dep.role;
    if (!groups[group]) groups[group] = [];
    groups[group].push(dep);
  }

  const sections = Object.entries(groups)
    .sort(([a], [b]) => ROLE_ORDER.indexOf(a as typeof ROLE_ORDER[number]) - ROLE_ORDER.indexOf(b as typeof ROLE_ORDER[number]))
    .map(([role, deps]) => {
      const label = ROLE_LABELS[role] ?? role;
      const rows = deps.map(d =>
        `| \`${d.name}\` | \`${d.version}\` | ${d.description ?? ''} |`
      ).join('\n');
      return `**${label}:**\n\n| Package | Version | Purpose |\n| ------- | ------- | ------- |\n${rows}`;
    })
    .join('\n\n');

  return sections;
}
