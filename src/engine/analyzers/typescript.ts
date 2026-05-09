import type { SupportedLanguage } from '../../types.js';
import { BaseAnalyzer, type ASTAnalysis } from '../base-analyzer.js';
import { registry } from '../language-registry.js';

export class TypeScriptAnalyzer extends BaseAnalyzer {
  readonly language: SupportedLanguage = 'typescript';

  getExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.jsx'];
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

      this.extractExports(trimmed, filePath, lineNum, exports, types, functions, imports);
      this.extractImports(trimmed, filePath, lineNum, imports);
    }

    return { exports, imports, types, functions };
  }

  private extractExports(
    line: string,
    file: string,
    lineNum: number,
    exports: ASTAnalysis['exports'],
    types: ASTAnalysis['types'],
    functions: ASTAnalysis['functions'],
    imports: ASTAnalysis['imports'],
  ): void {
    // Default export: export default function name() / export default class Name
    let m = line.match(/^export\s+default\s+(?:async\s+)?function\s+(\w+)/);
    if (m) {
      exports.push({ name: m[1], kind: 'function', file, line: lineNum, isDefault: true });
      functions.push({ name: m[1], file, line: lineNum, params: [], isExported: true });
      return;
    }

    m = line.match(/^export\s+default\s+class\s+(\w+)/);
    if (m) {
      exports.push({ name: m[1], kind: 'class', file, line: lineNum, isDefault: true });
      types.push({ name: m[1], kind: 'class', file, line: lineNum });
      return;
    }

    // React component: export default function PascalCase
    m = line.match(/^export\s+default\s+function\s+([A-Z]\w*)/);
    if (m) {
      exports.push({ name: m[1], kind: 'function', file, line: lineNum, isDefault: true });
      functions.push({ name: m[1], file, line: lineNum, params: [], isExported: true });
      return;
    }

    // Default export with expression: export default ComponentName (standalone)
    m = line.match(/^export\s+default\s+([A-Z]\w+)\s*;?\s*$/);
    if (m) {
      exports.push({ name: m[1], kind: 'variable', file, line: lineNum, isDefault: true });
      return;
    }

    // Default export wrapped: export default memo(ComponentName) / export default React.memo(ComponentName)
    m = line.match(/^export\s+default\s+(?:\w+\.\s*)?(\w+)\s*\(\s*([A-Z]\w*)\s*\)/);
    if (m) {
      exports.push({ name: m[2], kind: 'variable', file, line: lineNum, isDefault: true });
      return;
    }

    // React component export: export function PascalCase or export const PascalCase = () =>
    m = line.match(/^export\s+function\s+([A-Z]\w*)/);
    if (m) {
      exports.push({ name: m[1], kind: 'function', file, line: lineNum, isDefault: false });
      functions.push({ name: m[1], file, line: lineNum, params: [], isExported: true });
      return;
    }

    // React component: export const PascalCase = () => or export const PascalCase = function
    m = line.match(/^export\s+const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/);
    if (m) {
      exports.push({ name: m[1], kind: 'function', file, line: lineNum, isDefault: false });
      functions.push({ name: m[1], file, line: lineNum, params: [], isExported: true });
      return;
    }

    // Named export: export function / export async function
    m = line.match(/^export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(.+?))?$/);
    if (m) {
      const params = this.parseParams(m[2]);
      exports.push({ name: m[1], kind: 'function', file, line: lineNum, isDefault: false });
      functions.push({
        name: m[1], file, line: lineNum, params,
        returnType: m[3]?.trim() || undefined,
        isExported: true,
      });
      return;
    }

    // Export interface
    m = line.match(/^export\s+interface\s+(\w+)/);
    if (m) {
      exports.push({ name: m[1], kind: 'interface', file, line: lineNum, isDefault: false });
      types.push({ name: m[1], kind: 'interface', file, line: lineNum });
      return;
    }

    // Export type alias
    m = line.match(/^export\s+type\s+(\w+)/);
    if (m) {
      exports.push({ name: m[1], kind: 'type', file, line: lineNum, isDefault: false });
      types.push({ name: m[1], kind: 'type', file, line: lineNum });
      return;
    }

    // Export enum
    m = line.match(/^export\s+enum\s+(\w+)/);
    if (m) {
      exports.push({ name: m[1], kind: 'enum', file, line: lineNum, isDefault: false });
      types.push({ name: m[1], kind: 'enum', file, line: lineNum });
      return;
    }

    // Export class
    m = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
    if (m) {
      exports.push({ name: m[1], kind: 'class', file, line: lineNum, isDefault: false });
      types.push({ name: m[1], kind: 'class', file, line: lineNum });
      return;
    }

    // Export const/let/var
    m = line.match(/^export\s+const\s+(\w+)\s*=/);
    if (m) {
      // Check if arrow function: export const name = (...) => or export const name = () =>
      const arrowMatch = line.match(/^export\s+const\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/);
      if (arrowMatch) {
        exports.push({ name: m[1], kind: 'function', file, line: lineNum, isDefault: false });
        functions.push({ name: m[1], file, line: lineNum, params: [], isExported: true });
      } else {
        exports.push({ name: m[1], kind: 'constant', file, line: lineNum, isDefault: false });
      }
      return;
    }

    m = line.match(/^export\s+(?:let|var)\s+(\w+)/);
    if (m) {
      exports.push({ name: m[1], kind: 'variable', file, line: lineNum, isDefault: false });
      return;
    }

    // Re-export: export { X, Y } from 'module'
    m = line.match(/^export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (m) {
      const specifiers = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      const source = m[2];
      for (const spec of specifiers) {
        exports.push({ name: spec, kind: 'variable', file, line: lineNum, isDefault: false });
      }
      imports.push({ source, specifiers, isExternal: this.isExternal(source), file, line: lineNum });
      return;
    }

    // Barrel re-export: export * from 'module'
    m = line.match(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/);
    if (m) {
      exports.push({ name: '*', kind: 'variable', file, line: lineNum, isDefault: false });
      imports.push({ source: m[1], specifiers: ['*'], isExternal: this.isExternal(m[1]), file, line: lineNum });
    }
  }

  private extractImports(
    line: string,
    file: string,
    lineNum: number,
    imports: ASTAnalysis['imports'],
  ): void {
    // Named import: import { X, Y } from 'module'
    let m = line.match(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (m) {
      const specifiers = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      imports.push({ source: m[2], specifiers, isExternal: this.isExternal(m[2]), file, line: lineNum });
      return;
    }

    // Default import: import X from 'module'
    m = line.match(/^import\s+(\w+)\s*,?\s*(?:\{[^}]*\})?\s+from\s+['"]([^'"]+)['"]/);
    if (m) {
      const specifiers = [m[1]];
      imports.push({ source: m[2], specifiers, isExternal: this.isExternal(m[2]), file, line: lineNum });
      return;
    }

    // Side-effect import: import 'module'
    m = line.match(/^import\s+['"]([^'"]+)['"]/);
    if (m) {
      imports.push({ source: m[1], specifiers: [], isExternal: this.isExternal(m[1]), file, line: lineNum });
      return;
    }

    // Dynamic import: import('module')
    m = line.match(/import\(['"]([^'"]+)['"]\)/);
    if (m) {
      imports.push({ source: m[1], specifiers: ['dynamic'], isExternal: this.isExternal(m[1]), file, line: lineNum });
    }
  }

  private parseParams(paramStr: string): string[] {
    if (!paramStr.trim()) return [];
    return paramStr.split(',').map(p => p.trim()).filter(Boolean);
  }

  private isExternal(source: string): boolean {
    return !source.startsWith('.') && !source.startsWith('/');
  }
}

registry.register(new TypeScriptAnalyzer());
