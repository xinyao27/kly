export type Language = "typescript" | "javascript" | "swift";

export type SymbolKind =
  | "class"
  | "function"
  | "method"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "protocol"
  | "struct";

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  description: string;
}

export interface FileIndex {
  path: string;
  name: string;
  description: string;
  language: Language;
  imports: string[];
  exports: string[];
  symbols: SymbolInfo[];
  summary: string;
  hash: string;
  indexedAt: number;
}

export interface IndexStore {
  version: number;
  generatedAt: number;
  files: FileIndex[];
}

export interface KlyConfig {
  llm: {
    provider: string;
    model: string;
    apiKey: string;
  };
  include: string[];
  exclude: string[];
}

export interface ParseResult {
  imports: string[];
  exports: string[];
  symbols: SymbolInfo[];
}

export interface BranchState {
  lastCommit: string;
  lastBuilt: number;
  forkedFrom?: string;
}

export interface GitState {
  version: number;
  configHash: string;
  branches: Record<string, BranchState>;
}

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: number;
  message: string;
}

export interface ErrorFrame {
  file: string;
  line: number;
  column?: number;
  function?: string;
}

export interface EnrichedFrame {
  file: string;
  line: number;
  column?: number;
  function?: string;
  // kly index
  fileDescription: string;
  fileSummary: string;
  symbols: SymbolInfo[];
  language: Language;
  // kly dependencies
  importedBy: string[];
  importsFrom: string[];
  // git
  lastModified: GitCommit | null;
  recentCommits: GitCommit[];
}

export interface EnrichedErrorStack {
  frames: EnrichedFrame[];
  affectedFiles: number;
}

export interface GitDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
}
