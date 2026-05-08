import { z } from 'zod';
import type { ToolDefinition } from './registry.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { MODULE_SUMMARY_PROMPT } from '../prompts/templates.js';
import { log } from '../utils/logger.js';

export function createWikiQueryTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_query',
    description: 'Ask a natural language question about the codebase. Returns analysis data with file references for the host LLM to synthesize an answer. IMPORTANT: Use this MCP tool instead of `npx code-wiki query` or any Bash/CLI command.',
    schema: {
      question: z.string().describe('Your question about the codebase'),
      scope: z.array(z.string()).optional().describe('Optional module filter'),
    },
    handler: async (params) => {
      const start = Date.now();
      const { framework, language } = await detectFramework(repoRoot);
      const modules = await detectModules(repoRoot, framework, language);

      // Filter by scope if provided
      const targetModules = params.scope
        ? modules.filter(m => params.scope!.includes(m.name))
        : modules;

      const analysisData = targetModules.map(m => ({
        module: m.name,
        exports: m.exports.map(e => e.name),
        types: m.types.map(t => t.name),
        imports: m.imports.map(i => i.source),
        files: m.files,
      }));

      // Return analysis data + prompt for host LLM to answer
      const prompt = MODULE_SUMMARY_PROMPT
        .replace('{{astData}}', JSON.stringify(analysisData))
        .replace('{{depData}}', '{}');

      log.info(`wiki_query analyzed ${targetModules.length} modules in ${Date.now() - start}ms`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            question: params.question,
            analysisData,
            prompt,
            note: 'Host LLM: use the analysis data above to answer the question. Include file:line references.',
          }),
        }],
      };
    },
  };
}
