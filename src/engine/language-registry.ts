import type { SupportedLanguage } from '../types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { LANGUAGE_EXTENSIONS } from '../constants.js';

export class LanguageRegistry {
  private analyzers = new Map<SupportedLanguage, BaseAnalyzer>();

  register(analyzer: BaseAnalyzer): void {
    this.analyzers.set(analyzer.language, analyzer);
  }

  get(language: SupportedLanguage): BaseAnalyzer | undefined {
    return this.analyzers.get(language);
  }

  getByFile(filePath: string): BaseAnalyzer | undefined {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const lang = LANGUAGE_EXTENSIONS[ext] as SupportedLanguage | undefined;
    if (!lang) return undefined;
    return this.analyzers.get(lang);
  }

  getRegisteredLanguages(): SupportedLanguage[] {
    return Array.from(this.analyzers.keys());
  }
}

// Singleton registry — language analyzers register themselves on import
export const registry = new LanguageRegistry();