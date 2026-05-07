import type { SupportedLanguage } from '../../types.js';
import { BaseAnalyzer, type ASTAnalysis } from '../base-analyzer.js';
import { registry } from '../language-registry.js';

export class JavaAnalyzer extends BaseAnalyzer {
  readonly language: SupportedLanguage = 'java';

  getExtensions(): string[] {
    return ['.java'];
  }

  analyzeFile(filePath: string, content: string): ASTAnalysis {
    const lines = content.split('\n');
    const exports: ASTAnalysis['exports'] = [];
    const imports: ASTAnalysis['imports'] = [];
    const types: ASTAnalysis['types'] = [];
    const functions: ASTAnalysis['functions'] = [];

    let currentPackage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Package declaration
      let m = trimmed.match(/^package\s+([\w.]+)\s*;/);
      if (m) {
        currentPackage = m[1];
        continue;
      }

      // Import
      m = trimmed.match(/^import\s+(?:static\s+)?([\w.*]+)\s*;/);
      if (m) {
        const source = m[1];
        const isExternal = currentPackage ? !source.startsWith(currentPackage.split('.').slice(0, -1).join('.') || currentPackage) : true;
        imports.push({ source, specifiers: [source.split('.').pop() || source], isExternal, file: filePath, line: lineNum });
        continue;
      }

      // Public class
      m = trimmed.match(/^public\s+(?:abstract\s+|final\s+)*class\s+(\w+)/);
      if (m) {
        exports.push({ name: m[1], kind: 'class', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'class', file: filePath, line: lineNum });
        continue;
      }

      // Public interface
      m = trimmed.match(/^public\s+interface\s+(\w+)/);
      if (m) {
        exports.push({ name: m[1], kind: 'interface', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'interface', file: filePath, line: lineNum });
        continue;
      }

      // Public enum
      m = trimmed.match(/^public\s+enum\s+(\w+)/);
      if (m) {
        exports.push({ name: m[1], kind: 'enum', file: filePath, line: lineNum, isDefault: false });
        types.push({ name: m[1], kind: 'enum', file: filePath, line: lineNum });
        continue;
      }

      // Non-public class/interface/enum (still a type)
      m = trimmed.match(/^(?:abstract\s+|final\s+)*class\s+(\w+)/);
      if (m) {
        types.push({ name: m[1], kind: 'class', file: filePath, line: lineNum });
        continue;
      }

      m = trimmed.match(/^interface\s+(\w+)/);
      if (m) {
        types.push({ name: m[1], kind: 'interface', file: filePath, line: lineNum });
        continue;
      }

      m = trimmed.match(/^enum\s+(\w+)/);
      if (m) {
        types.push({ name: m[1], kind: 'enum', file: filePath, line: lineNum });
        continue;
      }

      // Public method
      m = trimmed.match(/^public\s+(?:static\s+)?(?:[\w<>\[\],\s]+?)\s+(\w+)\s*\(([^)]*)\)/);
      if (m) {
        const name = m[1];
        // Skip constructor (method name matches class name — handled below)
        const returnTypeMatch = trimmed.match(/^public\s+(?:static\s+)?([\w<>\[\]]+)\s+\w+\s*\(/);
        const params = this.parseParams(m[2]);
        exports.push({ name, kind: 'function', file: filePath, line: lineNum, isDefault: false });
        functions.push({
          name, file: filePath, line: lineNum, params,
          returnType: returnTypeMatch?.[1] || undefined,
          isExported: true,
        });
      }
    }

    return { exports, imports, types, functions };
  }

  private parseParams(paramStr: string): string[] {
    if (!paramStr.trim()) return [];
    return paramStr.split(',').map(p => {
      const parts = p.trim().split(/\s+/);
      return parts.length >= 2 ? parts[parts.length - 1] : parts[0];
    }).filter(Boolean);
  }
}

registry.register(new JavaAnalyzer());
