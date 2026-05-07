import type { ExportDef, ImportDef, TypeDef, FunctionSig, SupportedLanguage } from '../types.js';

export interface ASTAnalysis {
  exports: ExportDef[];
  imports: ImportDef[];
  types: TypeDef[];
  functions: FunctionSig[];
}

export abstract class BaseAnalyzer {
  abstract readonly language: SupportedLanguage;

  abstract analyzeFile(filePath: string, content: string): ASTAnalysis;

  isRelevantFile(filePath: string): boolean {
    return this.getExtensions().some(ext => filePath.endsWith(ext));
  }

  abstract getExtensions(): string[];
}