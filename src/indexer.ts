import fs from "node:fs";
import path from "node:path";

import { hashConfig, loadConfig } from "./config";
import type { IndexDatabase } from "./database";
import { filterGitDiff } from "./diff-filter";
import {
  getCurrentBranch,
  getCurrentCommit,
  getChangedFiles,
  isAncestor,
  getMergeBase,
  isGitRepo,
  branchToDbName,
} from "./git";
import { resolveImport } from "./graph";
import { hashFile, hasChanged } from "./hasher";
import { LLMService } from "./llm/index";
import { ParserManager } from "./parser/index";
import { scanFiles } from "./scanner";
import {
  openDatabase,
  loadState,
  saveState,
  getBranchState,
  setBranchState,
  copyDatabase,
} from "./store";
import type { BranchState, FileIndex } from "./types";

export interface IndexProgress {
  total: number;
  completed: number;
  current: string;
  skipped: number;
}

export type ProgressCallback = (progress: IndexProgress) => void;

export interface IndexOptions {
  incremental?: boolean;
  full?: boolean;
  quiet?: boolean;
  onProgress?: ProgressCallback;
}

export interface BuildResult {
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
  deletedFiles: number;
  unchangedFiles: number;
  branch: string;
  commit: string;
  durationMs: number;
}

function emptyBuildResult(root: string): BuildResult {
  const gitRepo = isGitRepo(root);
  return {
    totalFiles: 0,
    newFiles: 0,
    updatedFiles: 0,
    deletedFiles: 0,
    unchangedFiles: 0,
    branch: gitRepo ? (getCurrentBranch(root) || "detached") : "default",
    commit: gitRepo ? getCurrentCommit(root) : "",
    durationMs: 0,
  };
}

export async function buildIndex(root: string, options: IndexOptions = {}): Promise<BuildResult> {
  const start = Date.now();
  const config = loadConfig(root);
  const parserManager = new ParserManager();
  const llmService = new LLMService(config);

  const gitRepo = isGitRepo(root);

  let result: BuildResult;
  if (gitRepo && !options.full) {
    result = await buildGitAware(root, config, parserManager, llmService, options);
  } else {
    result = await buildClassic(root, config, parserManager, llmService, options);
  }

  result.durationMs = Date.now() - start;
  return result;
}

async function buildGitAware(
  root: string,
  config: ReturnType<typeof loadConfig>,
  parserManager: ParserManager,
  llmService: LLMService,
  options: IndexOptions,
): Promise<BuildResult> {
  const branch = getCurrentBranch(root);
  const commit = getCurrentCommit(root);
  const dbName = branchToDbName(branch, commit);

  const state = loadState(root);
  const currentConfigHash = hashConfig(config);

  let result: BuildResult;

  // Config changed — force full rebuild
  if (state.configHash && state.configHash !== currentConfigHash) {
    result = await buildClassic(root, config, parserManager, llmService, options, dbName);
    state.configHash = currentConfigHash;
    setBranchState(state, dbName, { lastCommit: commit, lastBuilt: Date.now() });
    saveState(root, state);
    return result;
  }

  const branchState = getBranchState(state, dbName);

  if (branchState?.lastCommit) {
    if (isAncestor(root, branchState.lastCommit, commit)) {
      // Normal incremental: diff from last indexed commit
      result = await buildFromGitDiff(
        root,
        config,
        parserManager,
        llmService,
        options,
        dbName,
        branchState.lastCommit,
        commit,
      );
    } else {
      // Rebase/force push: fall back to hash-based incremental
      result = await buildClassic(root, config, parserManager, llmService, options, dbName);
    }
  } else {
    // New branch: try to fork from parent
    const forkedFromDb = tryForkFromParent(root, dbName, state);
    if (forkedFromDb) {
      // Track the fork origin so we can preserve it across rebuilds
      setBranchState(state, dbName, { lastCommit: "", lastBuilt: 0, forkedFrom: forkedFromDb });
      // parentState is guaranteed to exist — tryForkFromParent checks state.branches[candidate]
      const parentState = getBranchState(state, forkedFromDb)!;
      const mergeBase = getMergeBase(root, parentState.lastCommit, commit);
      if (mergeBase) {
        result = await buildFromGitDiff(
          root,
          config,
          parserManager,
          llmService,
          options,
          dbName,
          mergeBase,
          commit,
        );
      } else {
        result = await buildClassic(root, config, parserManager, llmService, options, dbName);
      }
    } else {
      // Full build
      result = await buildClassic(root, config, parserManager, llmService, options, dbName);
    }
  }

  state.configHash = currentConfigHash;
  const newBranchState: BranchState = {
    lastCommit: commit,
    lastBuilt: Date.now(),
  };
  // Preserve forkedFrom if it was previously set
  const currentBranchState = getBranchState(state, dbName);
  if (currentBranchState?.forkedFrom) {
    newBranchState.forkedFrom = currentBranchState.forkedFrom;
  }
  setBranchState(state, dbName, newBranchState);
  saveState(root, state);
  return result;
}

function tryForkFromParent(
  root: string,
  dbName: string,
  state: { branches: Record<string, { lastCommit: string }> },
): string | null {
  // Try to find "main" or "master" as parent
  for (const candidate of ["main", "master"]) {
    if (state.branches[candidate] && candidate !== dbName) {
      copyDatabase(root, candidate, dbName);
      return candidate;
    }
  }
  return null;
}

async function buildFromGitDiff(
  root: string,
  config: ReturnType<typeof loadConfig>,
  parserManager: ParserManager,
  llmService: LLMService,
  options: IndexOptions,
  dbName: string,
  fromCommit: string,
  toCommit: string,
): Promise<BuildResult> {
  const gitDiff = getChangedFiles(root, fromCommit, toCommit);
  const filtered = filterGitDiff(gitDiff, config);

  // Handle renamed files: add the new path to index list, delete old path
  const toIndex = [...filtered.toIndex];
  const toDelete = [...filtered.toDelete];

  for (const r of filtered.renamed) {
    toIndex.push(r.to);
    toDelete.push(r.from);
  }

  const db = openDatabase(root, dbName);
  const result = emptyBuildResult(root);

  try {
    if (toDelete.length > 0) {
      db.removeFiles(toDelete);
      db.removeDependenciesBatch(toDelete);
      result.deletedFiles = toDelete.length;
    }

    if (toIndex.length === 0) {
      options.onProgress?.({
        total: 0,
        completed: 0,
        current: "",
        skipped: 0,
      });
      result.totalFiles = db.getFileCount();
      result.unchangedFiles = result.totalFiles;
      return result;
    }

    const indexResult = await indexFiles(root, toIndex, db, parserManager, llmService, options);
    result.newFiles = indexResult.newFiles;
    result.updatedFiles = indexResult.updatedFiles;
    result.totalFiles = db.getFileCount();
    result.unchangedFiles = result.totalFiles - result.newFiles - result.updatedFiles;
    return result;
  } finally {
    db.close();
  }
}

async function buildClassic(
  root: string,
  config: ReturnType<typeof loadConfig>,
  parserManager: ParserManager,
  llmService: LLMService,
  options: IndexOptions,
  dbName?: string,
): Promise<BuildResult> {
  const name =
    dbName ||
    (isGitRepo(root) ? branchToDbName(getCurrentBranch(root), getCurrentCommit(root)) : "default");
  const db = openDatabase(root, name);
  const result = emptyBuildResult(root);

  try {
    const files = await scanFiles(root, config);
    const progress: IndexProgress = {
      total: files.length,
      completed: 0,
      current: "",
      skipped: 0,
    };

    // Collect files that need indexing, track which already exist
    const toIndex: string[] = [];
    const existingPaths = new Set<string>();

    for (const filePath of files) {
      const hash = hashFile(root, filePath);
      const existing = db.getFile(filePath);

      if (existing) {
        existingPaths.add(filePath);
      }

      if (existing && !hasChanged(existing.hash, hash) && !options.full) {
        progress.skipped++;
        progress.completed++;
        result.unchangedFiles++;
        options.onProgress?.(progress);
        continue;
      }

      toIndex.push(filePath);
    }

    if (toIndex.length > 0) {
      const indexResult = await indexFiles(
        root,
        toIndex,
        db,
        parserManager,
        llmService,
        options,
        progress,
      );
      // Determine new vs updated based on whether they existed before
      for (const filePath of toIndex) {
        if (existingPaths.has(filePath)) {
          result.updatedFiles++;
        } else {
          result.newFiles++;
        }
      }
    }

    // Remove files that no longer exist on disk
    const fileSet = new Set(files);
    const allIndexed = db.getAllFiles();
    const toRemove = allIndexed.filter((f) => !fileSet.has(f.path)).map((f) => f.path);
    if (toRemove.length > 0) {
      db.removeFiles(toRemove);
      db.removeDependenciesBatch(toRemove);
      result.deletedFiles = toRemove.length;
    }

    result.totalFiles = db.getFileCount();
    return result;
  } finally {
    db.close();
  }
}

interface IndexFilesResult {
  indexed: number;
  newFiles: number;
  updatedFiles: number;
}

async function indexFiles(
  root: string,
  filePaths: string[],
  db: IndexDatabase,
  parserManager: ParserManager,
  llmService: LLMService,
  options: IndexOptions,
  progress?: IndexProgress,
): Promise<IndexFilesResult> {
  const prog = progress || {
    total: filePaths.length,
    completed: 0,
    current: "",
    skipped: 0,
  };

  if (!progress) {
    prog.total = filePaths.length;
  }

  // Read and parse files
  const parsedFiles = filePaths.map((filePath) => {
    const fullPath = path.join(root, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const hash = hashFile(root, filePath);
    const language = parserManager.getLanguage(filePath);
    const parseResult = parserManager.parse(content, filePath);

    return {
      path: filePath,
      content,
      hash,
      language: language || ("typescript" as const),
      imports: parseResult?.imports || [],
      exports: parseResult?.exports || [],
      symbols: parseResult?.symbols || [],
    };
  });

  // LLM index in batches
  const llmResults = await llmService.indexFiles(
    parsedFiles.map((f) => ({
      path: f.path,
      content: f.content,
      symbols: f.symbols,
    })),
  );

  // Merge and upsert
  const fileIndexes: FileIndex[] = parsedFiles.map((file) => {
    const llmResult = llmResults.get(file.path);

    const fileIndex: FileIndex = {
      path: file.path,
      name: llmResult?.name || path.basename(file.path),
      description: llmResult?.description || "",
      language: file.language,
      imports: file.imports,
      exports: file.exports,
      symbols: file.symbols.map((s) => {
        const llmSymbol = llmResult?.symbols.find((ls) => ls.name === s.name);
        return {
          ...s,
          description: llmSymbol?.description || s.description,
        };
      }),
      summary: llmResult?.summary || "",
      hash: file.hash,
      indexedAt: Date.now(),
    };

    prog.completed++;
    prog.current = file.path;
    options.onProgress?.(prog);

    return fileIndex;
  });

  db.upsertFiles(fileIndexes);

  // Build and write dependencies
  const allFiles = db.getAllFiles();
  const indexedPaths = new Set(allFiles.map((f) => f.path));
  const depEntries: Array<{ fromPath: string; toPaths: string[] }> = [];

  for (const file of parsedFiles) {
    const resolved: string[] = [];
    for (const imp of file.imports) {
      const target = resolveImport(file.path, imp, indexedPaths);
      if (target) resolved.push(target);
    }
    depEntries.push({ fromPath: file.path, toPaths: resolved });
  }

  if (depEntries.length > 0) {
    db.upsertBatchDependencies(depEntries);
  }

  return {
    indexed: fileIndexes.length,
    newFiles: 0, // caller determines new vs updated
    updatedFiles: 0,
  };
}
