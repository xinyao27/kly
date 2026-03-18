// Core types
export type {
  FileIndex,
  IndexStore,
  KlyConfig,
  Language,
  ParseResult,
  SymbolInfo,
  SymbolKind,
} from "./types.js";

// Config
export {
  getConfigPath,
  getIndexPath,
  getKlyDir,
  initKlyDir,
  isInitialized,
  loadConfig,
} from "./config.js";

// Scanner
export { scanFiles } from "./scanner.js";

// Hasher
export { hashFile, hasChanged } from "./hasher.js";

// Store
export {
  createEmptyStore,
  getFileIndex,
  loadStore,
  removeFileIndex,
  saveStore,
  upsertFileIndex,
} from "./store.js";

// Parser
export { ParserManager } from "./parser/index.js";

// LLM
export { LLMService } from "./llm/index.js";

// Indexer
export { buildIndex } from "./indexer.js";
export type { IndexOptions, IndexProgress, ProgressCallback } from "./indexer.js";

// Query
export { filterByLanguage, filterByPath, searchFiles } from "./query.js";
export type { SearchResult } from "./query.js";
