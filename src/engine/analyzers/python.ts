import type { SupportedLanguage } from '../../types.js';
import { BaseAnalyzer, type ASTAnalysis } from '../base-analyzer.js';
import { registry } from '../language-registry.js';

const STDLIB_PREFIXES = [
  'os', 'sys', 'pathlib', 'json', 'typing', 'collections', 'io', 'abc',
  'dataclasses', 'enum', 'functools', 'itertools', 'logging', 're',
  'datetime', 'time', 'math', 'random', 'string', 'copy', 'hashlib',
  'http', 'urllib', 'email', 'html', 'xml', 'csv', 'sqlite3',
  'unittest', 'argparse', 'configparser', 'tempfile', 'shutil',
  'subprocess', 'threading', 'multiprocessing', 'asyncio', 'contextlib',
];

export class PythonAnalyzer extends BaseAnalyzer {
  readonly language: SupportedLanguage = 'python';

  getExtensions(): string[] {
    return ['.py', '.pyi'];
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

      this.extractDefinitions(trimmed, filePath, lineNum, exports, types, functions);
      this.extractImports(trimmed, filePath, lineNum, imports);
    }

    return { exports, imports, types, functions };
  }

  private extractDefinitions(
    line: string,
    file: string,
    lineNum: number,
    exports: ASTAnalysis['exports'],
    types: ASTAnalysis['types'],
    functions: ASTAnalysis['functions'],
  ): void {
    // Skip private names (but allow __init__, __all__, __str__ etc.)
    const isPrivate = (name: string) => name.startsWith('_') && !name.startsWith('__');

    // Class definition
    let m = line.match(/^(?:async\s+)?class\s+(\w+)/);
    if (m) {
      if (isPrivate(m[1])) return;
      exports.push({ name: m[1], kind: 'class', file, line: lineNum, isDefault: false });
      types.push({ name: m[1], kind: 'class', file, line: lineNum });
      return;
    }

    // Function definition
    m = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?$/);
    if (m) {
      if (isPrivate(m[1])) return;
      const params = this.parseParams(m[2]);
      const returnType = m[3] ? m[3].replace(/:$/, '').trim() : undefined;
      exports.push({ name: m[1], kind: 'function', file, line: lineNum, isDefault: false });
      functions.push({
        name: m[1], file, line: lineNum, params,
        returnType,
        isExported: true,
      });
      return;
    }

    // Module-level constant (SCREAMING_SNAKE_CASE)
    m = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*/);
    if (m && !isPrivate(m[1])) {
      exports.push({ name: m[1], kind: 'constant', file, line: lineNum, isDefault: false });
    }
  }

  private extractImports(
    line: string,
    file: string,
    lineNum: number,
    imports: ASTAnalysis['imports'],
  ): void {
    // from X import Y, Z
    let m = line.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
    if (m) {
      const source = m[1];
      const specifiers = m[2].split(',').map(s => {
        const part = s.trim().split(/\s+as\s+/)[0].trim();
        return part.replace(/[()]/g, '');
      }).filter(Boolean);
      imports.push({ source, specifiers, isExternal: this.isExternal(source), file, line: lineNum });
      return;
    }

    // import X, Y
    m = line.match(/^import\s+(.+)/);
    if (m) {
      const modules = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      for (const mod of modules) {
        imports.push({ source: mod, specifiers: [mod.split('.')[0]], isExternal: this.isExternal(mod), file, line: lineNum });
      }
    }
  }

  private parseParams(paramStr: string): string[] {
    if (!paramStr.trim()) return [];
    return paramStr.split(',').map(p => p.trim()).filter(p => p && p !== 'self' && p !== 'cls');
  }

  private isExternal(source: string): boolean {
    if (source.startsWith('.')) return false;
    const root = source.split('.')[0];
    // Project-internal packages common in FastAPI/Python apps
    const internalRoots = ['src', 'app', 'lib', 'core', 'modules', 'api', 'utils', 'models', 'schemas', 'services', 'algorithm', 'agents', 'routers', 'config', 'repositories', 'middleware', 'regulations', 'test', 'common'];
    if (internalRoots.includes(root)) return false;
    // Everything else (stdlib, third-party) is external
    return true;
  }
}

registry.register(new PythonAnalyzer());
