import type { SupportedLanguage } from '../../types.js';
import { BaseAnalyzer, type ASTAnalysis } from '../base-analyzer.js';
import { registry } from '../language-registry.js';

export class RubyAnalyzer extends BaseAnalyzer {
  readonly language: SupportedLanguage = 'ruby';

  getExtensions(): string[] {
    return ['.rb'];
  }

  analyzeFile(filePath: string, content: string): ASTAnalysis {
    const lines = content.split('\n');
    const exports: ASTAnalysis['exports'] = [];
    const imports: ASTAnalysis['imports'] = [];
    const types: ASTAnalysis['types'] = [];
    const functions: ASTAnalysis['functions'] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // require_relative (internal import)
      let m = trimmed.match(/^require_relative\s+['"]([^'"]+)['"]/);
      if (m) {
        imports.push({ source: m[1], specifiers: [m[1]], isExternal: false, file: filePath, line: lineNum });
        continue;
      }

      // require (external import)
      m = trimmed.match(/^require\s+['"]([^'"]+)['"]/);
      if (m) {
        imports.push({ source: m[1], specifiers: [m[1]], isExternal: true, file: filePath, line: lineNum });
        continue;
      }

      // Module definition
      m = trimmed.match(/^module\s+(\w+)/);
      if (m) {
        exports.push({ name: m[1], kind: 'class', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'class', file: filePath, line: lineNum });
        continue;
      }

      // Class definition
      m = trimmed.match(/^class\s+(\w+)(?:\s*<\s*([\w:]+))?/);
      if (m) {
        exports.push({ name: m[1], kind: 'class', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'class', file: filePath, line: lineNum });
        continue;
      }

      // Class method (self.method_name)
      m = trimmed.match(/^def\s+self\.(\w+[?!]?)/);
      if (m) {
        exports.push({ name: m[1], kind: 'function', file: filePath, line: lineNum, isDefault: false });
        functions.push({ name: m[1], file: filePath, line: lineNum, params: [], isExported: true });
        continue;
      }

      // Instance method (skip private methods - they appear after 'private' keyword)
      m = trimmed.match(/^def\s+(\w+[?!]?)(?:\(([^)]*)\))?/);
      if (m) {
        const name = m[1];
        // Skip methods starting with _ (conventionally private)
        if (name.startsWith('_')) continue;
        const params = this.parseParams(m[2]);
        exports.push({ name, kind: 'function', file: filePath, line: lineNum, isDefault: false });
        functions.push({ name, file: filePath, line: lineNum, params, isExported: true });
        continue;
      }

      // Constant (SCREAMING_SNAKE_CASE)
      m = trimmed.match(/^([A-Z][A-Z0-9_]*)\s*=\s*/);
      if (m) {
        exports.push({ name: m[1], kind: 'constant', file: filePath, line: lineNum, isDefault: false });
        continue;
      }

      // attr_accessor / attr_reader / attr_writer (may have multiple symbols)
      m = trimmed.match(/^attr_(?:accessor|reader|writer)\s+(.+)/);
      if (m) {
        const symbols = m[1].split(',').map(s => {
          const match = s.trim().match(/^:(\w+)/);
          return match ? match[1] : null;
        }).filter(Boolean) as string[];
        for (const sym of symbols) {
          exports.push({ name: sym, kind: 'function', file: filePath, line: lineNum, isDefault: false });
          functions.push({ name: sym, file: filePath, line: lineNum, params: [], isExported: true });
        }
      }
    }

    return { exports, imports, types, functions };
  }

  private parseParams(paramStr: string | undefined): string[] {
    if (!paramStr?.trim()) return [];
    return paramStr.split(',').map(p => {
      const trimmed = p.trim();
      // Remove leading * (splat) or & (block)
      return trimmed.replace(/^[*&]/, '').split(':')[0].split('=')[0].trim();
    }).filter(Boolean);
  }
}

registry.register(new RubyAnalyzer());
