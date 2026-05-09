// ── Language & Framework ──

export type SupportedLanguage = 'typescript' | 'python' | 'go' | 'java' | 'rust' | 'ruby';

export type Framework =
  | 'nextjs' | 'fastapi' | 'django' | 'spring-boot' | 'rails'
  | 'go-standard' | 'rust-workspace' | 'generic';

// ── AST Analysis ──

export interface ExportDef {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'variable' | 'enum';
  file: string;
  line: number;
  isDefault: boolean;
}

export interface ImportDef {
  source: string;
  specifiers: string[];
  isExternal: boolean;
  file: string;
  line: number;
}

export interface TypeDef {
  name: string;
  kind: 'interface' | 'type' | 'class' | 'enum' | 'struct' | 'trait';
  file: string;
  line: number;
}

export interface FunctionSig {
  name: string;
  file: string;
  line: number;
  params: string[];
  returnType?: string;
  isExported: boolean;
}

// ── Module Detection ──

export interface ModuleDef {
  name: string;
  path: string;
  language: SupportedLanguage;
  files: string[];
  entryFile?: string;
  exports: ExportDef[];
  imports: ImportDef[];
  types: TypeDef[];
  functions: FunctionSig[];
}

// ── Dependency Graph ──

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'internal' | 'external';
  weight: number;
}

export interface DependencyGraph {
  modules: string[];
  edges: DependencyEdge[];
}

// ── Flow Tracing ──

export interface FlowStep {
  order: number;
  action: string;
  file: string;
  line: number;
  function: string;
}

export interface FlowErrorPath {
  condition: string;
  gotoStep: number;
  file: string;
  line: number;
}

export interface FlowDef {
  name: string;
  description: string;
  trigger: string;
  steps: FlowStep[];
  errorPaths: FlowErrorPath[];
  relatedModules: string[];
}

// ── Wiki Content ──

export interface KeyAbstraction {
  name: string;
  kind: 'type' | 'function' | 'class' | 'interface' | 'constant';
  description: string;
}

export interface UsagePattern {
  title: string;
  description: string;
  codeExample?: string;
  language?: string;
}

export interface QuickStart {
  description: string;
  codeExample: string;
  language?: string;
}

export interface ConfigKey {
  key: string;
  type: string;
  default?: string;
  description: string;
}

export interface Gotcha {
  description: string;
  severity: 'warning' | 'caution' | 'note';
}

export interface ProjectOverview {
  summary: string;
  businessContext: string;
  coreCapabilities: string[];
  targetUsers: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  role: 'core' | 'framework' | 'testing' | 'build' | 'database' | 'ui' | 'utility' | 'other';
  description?: string;
}

export interface TechStack {
  language: SupportedLanguage;
  languageVersion?: string;
  framework: Framework;
  runtime?: string;
  packageManager?: string;
  dependencies: DependencyInfo[];
}

export interface ModuleWiki {
  name: string;
  summary: string;
  readWhen: string[];
  responsibility: string;
  boundary: string;
  quickStart?: QuickStart;
  keyAbstractions: KeyAbstraction[];
  usagePatterns: UsagePattern[];
  invariants: string[];
  configKeys: ConfigKey[];
  keyTypes: string[];
  exports: string[];
  dependencies: { internal: string[]; external: string[] };
  dependents: string[];
  relatedModules: string[];
  gotchas: Gotcha[];
  flows?: FlowDef[];
}

export interface OverviewWiki {
  name: string;
  language: SupportedLanguage;
  framework: Framework;
  architecture: string;
  modules: Array<{
    name: string;
    path: string;
    responsibility: string;
    keyFiles: number;
    deps: string[];
  }>;
  entryPoints: string[];
  sharedLibs: string[];
  lastUpdated: string;
  overview?: ProjectOverview;
  techStack?: TechStack;
}

export interface ImpactResult {
  directlyAffected: Array<{ module: string; reason: string }>;
  potentiallyAffected: Array<{ module: string; reason: string }>;
  suggestedTests: string[];
  wikiDocsToUpdate: string[];
}

// ── Cache / Manifest ──

export interface ModuleCacheEntry {
  cacheFile: string;
  gitHash: string;
  fileCount: number;
  analyzedAt: string;
}

export interface Manifest {
  version: number;
  lastFullBuild: string;
  baseCommit: string;
  modules: Record<string, ModuleCacheEntry>;
}

// ── Tool Input/Output ──

export interface WikiOverviewInput {
  repoPath: string;
  depth?: 'brief' | 'full';
}

export interface WikiModuleInput {
  modulePath: string;
  includeFlows?: boolean;
}

export interface WikiFlowInput {
  description: string;
  entryFile?: string;
}

export interface WikiQueryInput {
  question: string;
  scope?: string[];
}

export interface WikiUpdateInput {
  scope?: 'full' | 'changed';
  paths?: string[];
  module?: string;
  generatedContent?: ModuleWiki;
}

export interface WikiImpactInput {
  changeDescription: string;
  targetFiles: string[];
}

export interface WikiUpdateResult {
  status?: string;
  instruction?: string;
  updatedModules: string[];
  newEntries: string[];
  removedEntries: string[];
  cacheInvalidated: boolean;
  durationMs: number;
  analysisData?: Record<string, unknown>;
  prompt?: string;
  overviewPrompt?: string;
  techStackData?: TechStack;
}