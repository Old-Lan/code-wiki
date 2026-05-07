import type { SupportedLanguage } from '../../types.js';
import { BaseAnalyzer, type ASTAnalysis } from '../base-analyzer.js';
import { registry } from '../language-registry.js';

export class RustAnalyzer extends BaseAnalyzer {
  readonly language: SupportedLanguage = 'rust';

  getExtensions(): string[] {
    return ['.rs'];
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

      // use declaration (grouped): use path::{A, B};
      let m = trimmed.match(/^use\s+([\w:]+)::\{([^}]+)\}\s*;/);
      if (m) {
        const source = m[1];
        const specifiers = m[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        imports.push({ source: `${source}::{...}`, specifiers, isExternal: this.isExternal(source), file: filePath, line: lineNum });
        continue;
      }

      // use declaration (simple): use path::name;
      m = trimmed.match(/^use\s+([\w:]+)(?:\s+as\s+\w+)?\s*;/);
      if (m) {
        const source = m[1];
        const parts = source.split('::');
        const specifiers = [parts[parts.length - 1]];
        imports.push({ source, specifiers, isExternal: this.isExternal(source), file: filePath, line: lineNum });
        continue;
      }

      // pub struct
      m = trimmed.match(/^pub\s+(?:struct|type)\s+(\w+)/);
      if (m) {
        const kind = trimmed.includes('struct') ? 'struct' : 'type';
        exports.push({ name: m[1], kind: kind === 'struct' ? 'class' : 'type', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: kind as 'struct' | 'type', file: filePath, line: lineNum });
        continue;
      }

      // pub enum
      m = trimmed.match(/^pub\s+enum\s+(\w+)/);
      if (m) {
        exports.push({ name: m[1], kind: 'enum', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'enum', file: filePath, line: lineNum });
        continue;
      }

      // pub trait
      m = trimmed.match(/^pub\s+trait\s+(\w+)/);
      if (m) {
        exports.push({ name: m[1], kind: 'interface', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'trait', file: filePath, line: lineNum });
        continue;
      }

      // Non-pub struct/enum/trait
      m = trimmed.match(/^(?:struct|type)\s+(\w+)/);
      if (m) {
        types.push({ name: m[1], kind: 'struct', file: filePath, line: lineNum });
        continue;
      }
      m = trimmed.match(/^enum\s+(\w+)/);
      if (m) {
        types.push({ name: m[1], kind: 'enum', file: filePath, line: lineNum });
        continue;
      }
      m = trimmed.match(/^trait\s+(\w+)/);
      if (m) {
        types.push({ name: m[1], kind: 'trait', file: filePath, line: lineNum });
        continue;
      }

      // pub fn (standalone or impl method)
      m = trimmed.match(/^pub\s+(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+?))?(?:\s*\{|$)?/);
      if (m) {
        const params = this.parseParams(m[2]);
        exports.push({ name: m[1], kind: 'function', file: filePath, line: lineNum, isDefault: false });
        functions.push({
          name: m[1], file: filePath, line: lineNum, params,
          returnType: m[3]?.trim() || undefined,
          isExported: true,
        });
        continue;
      }

      // pub const
      m = trimmed.match(/^pub\s+const\s+(\w+)/);
      if (m) {
        exports.push({ name: m[1], kind: 'constant', file: filePath, line: lineNum, isDefault: false });
        continue;
      }

      // impl methods: pub fn within impl block (indented)
      m = trimmed.match(/^\s*pub\s+(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+?))?(?:\s*\{|$)?/);
      if (m && trimmed.startsWith('    ')) {
        const params = this.parseParams(m[2]);
        exports.push({ name: m[1], kind: 'function', file: filePath, line: lineNum, isDefault: false });
        functions.push({
          name: m[1], file: filePath, line: lineNum, params,
          returnType: m[3]?.trim() || undefined,
          isExported: true,
        });
      }
    }

    return { exports, imports, types, functions };
  }

  private parseParams(paramStr: string): string[] {
    if (!paramStr.trim()) return [];
    return paramStr.split(',').map(p => {
      const trimmed = p.trim();
      if (!trimmed || trimmed === '&self' || trimmed === 'self' || trimmed === '&mut self') return '';
      // Extract param name (last identifier before : or end)
      const m = trimmed.match(/(\w+)\s*:/);
      return m ? m[1] : trimmed.split(/\s+/).pop() || '';
    }).filter(Boolean);
  }

  private isExternal(source: string): boolean {
    if (source.startsWith('crate::') || source.startsWith('super::') || source.startsWith('self::')) return false;
    return true;
  }
}

registry.register(new RustAnalyzer());
