import { z } from 'zod';
import type { ToolDefinition } from './registry.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { buildDependencyGraph, getDependents, getDependencies } from '../engine/graph-builder.js';
import { IMPACT_ANALYSIS_PROMPT } from '../prompts/templates.js';
import { log } from '../utils/logger.js';

export function createWikiImpactTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_impact',
    description: 'Analyze impact of planned changes. Returns affected modules, suggested tests, and docs to update.',
    schema: {
      change_description: z.string().describe('What you plan to change'),
      target_files: z.array(z.string()).describe('Files that will be modified'),
    },
    handler: async (params) => {
      const start = Date.now();
      const { framework, language } = await detectFramework(repoRoot);
      const modules = await detectModules(repoRoot, framework, language);
      const graph = buildDependencyGraph(modules);

      // Find directly affected modules
      const directlyAffected = modules
        .filter(m => params.target_files.some((f: string) => m.files.includes(f) || f.startsWith(m.path)))
        .map(m => ({ module: m.name, reason: `Contains target files` }));

      // Find potentially affected via dependencies
      const directlyNames = new Set(directlyAffected.map(d => d.module));
      const potentiallyAffected: Array<{ module: string; reason: string }> = [];
      for (const direct of directlyAffected) {
        const dependents = getDependents(graph, direct.module);
        for (const dep of dependents) {
          if (!directlyNames.has(dep)) {
            potentiallyAffected.push({ module: dep, reason: `Depends on ${direct.module}` });
          }
        }
      }

      // Suggest tests
      const suggestedTests = modules
        .filter(m => directlyNames.has(m.name))
        .flatMap(m => m.files.filter(f => f.includes('test') || f.includes('spec')));

      const analysisData = {
        directlyAffected,
        potentiallyAffected,
        suggestedTests,
        changeDescription: params.change_description,
        targetFiles: params.target_files,
        graph: graph.edges,
      };

      const prompt = IMPACT_ANALYSIS_PROMPT
        .replace('{{changeDescription}}', params.change_description)
        .replace('{{targetFiles}}', JSON.stringify(params.target_files))
        .replace('{{depGraph}}', JSON.stringify(graph.edges))
        .replace('{{moduleData}}', JSON.stringify(modules.map(m => ({ name: m.name, exports: m.exports.map(e => e.name) }))));

      log.info(`wiki_impact completed in ${Date.now() - start}ms`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            directlyAffected,
            potentiallyAffected,
            suggestedTests,
            wikiDocsToUpdate: directlyAffected.map(d => `team/modules/${d.module}.md`),
            analysisData,
            prompt,
            note: 'Host LLM: use the analysis data above to refine the impact assessment if needed.',
          }, null, 2),
        }],
      };
    },
  };
}
