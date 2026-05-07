import { z } from 'zod';
import type { ToolDefinition } from './registry.js';
import { detectFramework } from '../engine/framework-detector.js';
import { detectModules } from '../engine/module-detector.js';
import { traceFlows } from '../engine/flow-tracer.js';
import { log } from '../utils/logger.js';

export function createWikiFlowTool(repoRoot: string): ToolDefinition {
  return {
    name: 'wiki_flow',
    description: 'Trace a business flow through code. Use when needing to understand how a feature works end-to-end.',
    schema: {
      description: z.string().describe('Natural language description of the flow to trace'),
      entry_file: z.string().optional().describe('Optional starting file hint'),
    },
    handler: async (params) => {
      const start = Date.now();
      const { framework, language } = await detectFramework(repoRoot);
      const modules = await detectModules(repoRoot, framework, language);
      const flows = traceFlows(modules);

      // Match flow by description
      const desc = params.description.toLowerCase();
      const matched = flows.filter(f =>
        f.name.toLowerCase().includes(desc) ||
        f.description.toLowerCase().includes(desc) ||
        f.steps.some(s => s.action.toLowerCase().includes(desc))
      );

      if (matched.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: 'No matching flows found',
              description: params.description,
              availableFlows: flows.map(f => f.name),
            }),
          }],
        };
      }

      log.info(`wiki_flow found ${matched.length} matching flows in ${Date.now() - start}ms`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(matched.length === 1 ? matched[0] : matched, null, 2),
        }],
      };
    },
  };
}
