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
