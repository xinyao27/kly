import fs from "node:fs";
import path from "node:path";

import { hashConfig, loadConfig } from "./config.js";
import type { IndexDatabase } from "./database.js";
import { filterGitDiff } from "./diff-filter.js";
import {
  getCurrentBranch,
  getCurrentCommit,
  getChangedFiles,
  isAncestor,
  getMergeBase,
  isGitRepo,
  branchToDbName,
} from "./git.js";
import { hashFile, hasChanged } from "./hasher.js";
import { LLMService } from "./llm/index.js";
import { ParserManager } from "./parser/index.js";
import { scanFiles } from "./scanner.js";
import {
  openDatabase,
  loadState,
  saveState,
  getBranchState,
  setBranchState,
  copyDatabase,
} from "./store.js";
import type { BranchState, FileIndex } from "./types.js";

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

export async function buildIndex(root: string, options: IndexOptions = {}): Promise<void> {
  const config = loadConfig(root);
  const parserManager = new ParserManager();
  const llmService = new LLMService(config);

  const gitRepo = isGitRepo(root);

  if (gitRepo && !options.full) {
    await buildGitAware(root, config, parserManager, llmService, options);
  } else {
    await buildClassic(root, config, parserManager, llmService, options);
  }
}

async function buildGitAware(
  root: string,
  config: ReturnType<typeof loadConfig>,
  parserManager: ParserManager,
  llmService: LLMService,
  options: IndexOptions,
): Promise<void> {
  const branch = getCurrentBranch(root);
  const commit = getCurrentCommit(root);
  const dbName = branchToDbName(branch, commit);

  const state = loadState(root);
  const currentConfigHash = hashConfig(config);

  // Config changed — force full rebuild
  if (state.configHash && state.configHash !== currentConfigHash) {
    await buildClassic(root, config, parserManager, llmService, options, dbName);
    state.configHash = currentConfigHash;
    setBranchState(state, dbName, { lastCommit: commit, lastBuilt: Date.now() });
    saveState(root, state);
    return;
  }

  const branchState = getBranchState(state, dbName);

  if (branchState?.lastCommit) {
    if (isAncestor(root, branchState.lastCommit, commit)) {
      // Normal incremental: diff from last indexed commit
      await buildFromGitDiff(
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
      await buildClassic(root, config, parserManager, llmService, options, dbName);
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
        await buildFromGitDiff(
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
        await buildClassic(root, config, parserManager, llmService, options, dbName);
      }
    } else {
      // Full build
      await buildClassic(root, config, parserManager, llmService, options, dbName);
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
): Promise<void> {
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
  try {
    if (toDelete.length > 0) {
      db.removeFiles(toDelete);
    }

    if (toIndex.length === 0) {
      options.onProgress?.({
        total: 0,
        completed: 0,
        current: "",
        skipped: 0,
      });
      return;
    }

    await indexFiles(root, toIndex, db, parserManager, llmService, options);
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
): Promise<void> {
  const name = dbName || (isGitRepo(root) ? branchToDbName(getCurrentBranch(root), getCurrentCommit(root)) : "default");
  const db = openDatabase(root, name);

  try {
    const files = await scanFiles(root, config);
    const progress: IndexProgress = {
      total: files.length,
      completed: 0,
      current: "",
      skipped: 0,
    };

    // Collect files that need indexing
    const toIndex: string[] = [];

    for (const filePath of files) {
      const hash = hashFile(root, filePath);
      const existing = db.getFile(filePath);

      if (existing && !hasChanged(existing.hash, hash) && !options.full) {
        progress.skipped++;
        progress.completed++;
        options.onProgress?.(progress);
        continue;
      }

      toIndex.push(filePath);
    }

    if (toIndex.length > 0) {
      await indexFiles(root, toIndex, db, parserManager, llmService, options, progress);
    }

    // Remove files that no longer exist on disk
    const fileSet = new Set(files);
    const allIndexed = db.getAllFiles();
    const toRemove = allIndexed.filter((f) => !fileSet.has(f.path)).map((f) => f.path);
    if (toRemove.length > 0) {
      db.removeFiles(toRemove);
    }
  } finally {
    db.close();
  }
}

async function indexFiles(
  root: string,
  filePaths: string[],
  db: IndexDatabase,
  parserManager: ParserManager,
  llmService: LLMService,
  options: IndexOptions,
  progress?: IndexProgress,
): Promise<void> {
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
}
