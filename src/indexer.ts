import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "./config.js";
import { hashFile, hasChanged } from "./hasher.js";
import { LLMService } from "./llm/index.js";
import { ParserManager } from "./parser/index.js";
import { scanFiles } from "./scanner.js";
import { loadStore, saveStore, upsertFileIndex } from "./store.js";
import type { FileIndex } from "./types.js";

export interface IndexProgress {
  total: number;
  completed: number;
  current: string;
  skipped: number;
}

export type ProgressCallback = (progress: IndexProgress) => void;

export interface IndexOptions {
  incremental?: boolean;
  onProgress?: ProgressCallback;
}

export async function buildIndex(root: string, options: IndexOptions = {}): Promise<void> {
  const config = loadConfig(root);
  const parserManager = new ParserManager();
  const llmService = new LLMService(config);
  const store = loadStore(root);

  const files = await scanFiles(root, config);
  const progress: IndexProgress = {
    total: files.length,
    completed: 0,
    current: "",
    skipped: 0,
  };

  // Collect files that need indexing
  const toIndex: { path: string; content: string; hash: string }[] = [];

  for (const filePath of files) {
    const hash = hashFile(root, filePath);

    if (options.incremental) {
      const existing = store.files.find((f) => f.path === filePath);
      if (existing && !hasChanged(existing.hash, hash)) {
        progress.skipped++;
        progress.completed++;
        options.onProgress?.(progress);
        continue;
      }
    }

    const fullPath = path.join(root, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    toIndex.push({ path: filePath, content, hash });
  }

  // Parse all files first
  const parsedFiles = toIndex.map((file) => {
    const language = parserManager.getLanguage(file.path);
    const parseResult = parserManager.parse(file.content, file.path);

    return {
      ...file,
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

  // Merge results
  for (const file of parsedFiles) {
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

    upsertFileIndex(store, fileIndex);

    progress.completed++;
    progress.current = file.path;
    options.onProgress?.(progress);
  }

  // Remove files that no longer exist
  const fileSet = new Set(files);
  store.files = store.files.filter((f) => fileSet.has(f.path));

  saveStore(root, store);
}
