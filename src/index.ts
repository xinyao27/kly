// Core types
export type {
  BranchState,
  FileIndex,
  GitDiff,
  GitState,
  KlyConfig,
  Language,
  ParseResult,
  SymbolInfo,
  SymbolKind,
} from "./types.js";

// Config
export {
  getConfigPath,
  getDbDir,
  getDbPath,
  getKlyDir,
  getStatePath,
  hashConfig,
  initKlyDir,
  isInitialized,
  loadConfig,
} from "./config.js";

// Database
export { IndexDatabase } from "./database.js";
export type { SearchResult } from "./database.js";

// Scanner
export { scanFiles } from "./scanner.js";

// Hasher
export { hashFile, hasChanged } from "./hasher.js";

// Git
export {
  branchToDbName,
  getChangedFiles,
  getCurrentBranch,
  getCurrentCommit,
  getMergeBase,
  isAncestor,
  isGitRepo,
} from "./git.js";

// Store
export {
  copyDatabase,
  getAllFilesFromDb,
  getBranchState,
  getFileFromDb,
  listBranchDbs,
  loadState,
  openDatabase,
  removeBranchDb,
  resolveDbName,
  saveState,
  setBranchState,
} from "./store.js";

// Diff Filter
export { filterGitDiff } from "./diff-filter.js";
export type { FilteredDiff } from "./diff-filter.js";

// Parser
export { ParserManager } from "./parser/index.js";

// LLM
export { LLMService } from "./llm/index.js";

// Indexer
export { buildIndex } from "./indexer.js";
export type { IndexOptions, IndexProgress, ProgressCallback } from "./indexer.js";

// Query
export { filterByLanguage, filterByPath, searchFiles } from "./query.js";
