// Core types
export type {
  BranchState,
  EnrichedErrorStack,
  EnrichedFrame,
  ErrorFrame,
  FileIndex,
  GitCommit,
  GitDiff,
  GitState,
  KlyConfig,
  Language,
  ParseResult,
  SymbolInfo,
  SymbolKind,
} from "./types";

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
} from "./config";

// Database
export { IndexDatabase } from "./database";
export type { SearchResult } from "./database";

// Scanner
export { scanFiles } from "./scanner";

// Hasher
export { hashFile, hasChanged } from "./hasher";

// Git
export {
  branchToDbName,
  getChangedFiles,
  getCurrentBranch,
  getCurrentCommit,
  getFileHistory,
  getMergeBase,
  isAncestor,
  isGitRepo,
} from "./git";

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
} from "./store";

// Diff Filter
export { filterGitDiff } from "./diff-filter";
export type { FilteredDiff } from "./diff-filter";

// Parser
export { ParserManager } from "./parser/index";

// LLM
export { LLMService } from "./llm/index";

// Indexer
export { buildIndex } from "./indexer";
export type { BuildResult, IndexOptions, IndexProgress, ProgressCallback } from "./indexer";

// Query
export { filterByLanguage, filterByPath, searchFiles, searchFilesWithRerank } from "./query";

// Reranker
export { rerankResults } from "./llm/reranker";

// Graph
export {
  buildDependencyGraph,
  generateMermaid,
  isRelativeImport,
  renderGraphAscii,
  renderGraphSvg,
  resolveImport,
} from "./graph";
export type { DependencyGraph, GraphEdge, GraphFormat, GraphNode } from "./graph";

// Enrich
export { enrichErrorStack } from "./enrich";
