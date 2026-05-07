import type { SupportedLanguage } from '../../types.js';
import { BaseAnalyzer, type ASTAnalysis } from '../base-analyzer.js';
import { registry } from '../language-registry.js';

export class GoAnalyzer extends BaseAnalyzer {
  readonly language: SupportedLanguage = 'go';

  getExtensions(): string[] {
    return ['.go'];
  }

  analyzeFile(filePath: string, content: string): ASTAnalysis {
    const lines = content.split('\n');
    const exports: ASTAnalysis['exports'] = [];
    const imports: ASTAnalysis['imports'] = [];
    const types: ASTAnalysis['types'] = [];
    const functions: ASTAnalysis['functions'] = [];

    let inImportBlock = false;
    let importBlockSources: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Handle multi-line import blocks
      if (inImportBlock) {
        if (trimmed === ')') {
          inImportBlock = false;
          for (const src of importBlockSources) {
            imports.push({ source: src, specifiers: [src], isExternal: this.isExternal(src), file: filePath, line: lineNum });
          }
        } else {
          const m = trimmed.match(/^"([^"]+)"/);
          if (m) importBlockSources.push(m[1]);
        }
        continue;
      }

      // Package declaration
      let m = trimmed.match(/^package\s+(\w+)/);
      if (m) continue;

      // Import block start
      m = trimmed.match(/^import\s*\(/);
      if (m) {
        inImportBlock = true;
        importBlockSources = [];
        continue;
      }

      // Single import
      m = trimmed.match(/^import\s+"([^"]+)"/);
      if (m) {
        imports.push({ source: m[1], specifiers: [m[1]], isExternal: this.isExternal(m[1]), file: filePath, line: lineNum });
        continue;
      }

      // Type struct
      m = trimmed.match(/^(?:type\s+)(\w+)\s+struct\s*\{/);
      if (m) {
        const isExported = this.isExported(m[1]);
        if (isExported) exports.push({ name: m[1], kind: 'class', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'struct', file: filePath, line: lineNum });
        continue;
      }

      // Type interface
      m = trimmed.match(/^(?:type\s+)(\w+)\s+interface\s*\{/);
      if (m) {
        const isExported = this.isExported(m[1]);
        if (isExported) exports.push({ name: m[1], kind: 'interface', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'interface', file: filePath, line: lineNum });
        continue;
      }

      // Type alias (not struct or interface)
      m = trimmed.match(/^type\s+(\w+)\s+([\w.*\[\]]+)/);
      if (m) {
        const isExported = this.isExported(m[1]);
        if (isExported) exports.push({ name: m[1], kind: 'type', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'type', file: filePath, line: lineNum });
        continue;
      }

      // Function with receiver (method)
      m = trimmed.match(/^func\s+\(\w+\s+\*?(\w+)\)\s+(\w+)\s*\(([^)]*)\)(?:\s+([\w.*\[\],\s()]+))?/);
      if (m) {
        const name = m[2];
        const isExported = this.isExported(name);
        const params = this.parseParams(m[3]);
        if (isExported) {
          exports.push({ name, kind: 'function', file: filePath, line: lineNum, isDefault: false });
          functions.push({
            name, file: filePath, line: lineNum, params,
            returnType: m[4]?.trim() || undefined,
            isExported: true,
          });
        }
        continue;
      }

      // Function (standalone)
      m = trimmed.match(/^func\s+(\w+)\s*\(([^)]*)\)(?:\s+([\w.*\[\],\s()]+))?/);
      if (m) {
        const name = m[1];
        const isExported = this.isExported(name);
        const params = this.parseParams(m[2]);
        if (isExported) {
          exports.push({ name, kind: 'function', file: filePath, line: lineNum, isDefault: false });
          functions.push({
            name, file: filePath, line: lineNum, params,
            returnType: m[3]?.trim() || undefined,
            isExported: true,
          });
        }
        continue;
      }

      // Const
      m = trimmed.match(/^const\s+(\w+)\s*/);
      if (m) {
        const isExported = this.isExported(m[1]);
        if (isExported) exports.push({ name: m[1], kind: 'constant', file: filePath, line: lineNum, isDefault: false });
      }
    }

    return { exports, imports, types, functions };
  }

  private parseParams(paramStr: string): string[] {
    if (!paramStr.trim()) return [];
    return paramStr.split(',').map(p => p.trim().split(/\s+/).pop() || '').filter(Boolean);
  }

  private isExported(name: string): boolean {
    return name[0] === name[0].toUpperCase();
  }

  private isExternal(source: string): boolean {
    if (source.startsWith('./') || source.startsWith('../')) return false;
    return true;
  }
}

registry.register(new GoAnalyzer());
