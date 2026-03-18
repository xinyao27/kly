import fs from "node:fs";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { getIndexPath } from "./config.js";
import type { FileIndex, IndexStore } from "./types.js";

const CURRENT_VERSION = 1;

export function createEmptyStore(): IndexStore {
  return {
    version: CURRENT_VERSION,
    generatedAt: Date.now(),
    files: [],
  };
}

export function loadStore(root: string): IndexStore {
  const indexPath = getIndexPath(root);
  if (!fs.existsSync(indexPath)) {
    return createEmptyStore();
  }

  const raw = fs.readFileSync(indexPath, "utf-8");
  return parseYaml(raw) as IndexStore;
}

export function saveStore(root: string, store: IndexStore): void {
  const indexPath = getIndexPath(root);
  store.generatedAt = Date.now();
  fs.writeFileSync(indexPath, stringifyYaml(store), "utf-8");
}

export function upsertFileIndex(store: IndexStore, fileIndex: FileIndex): void {
  const idx = store.files.findIndex((f) => f.path === fileIndex.path);
  if (idx >= 0) {
    store.files[idx] = fileIndex;
  } else {
    store.files.push(fileIndex);
  }
}

export function removeFileIndex(store: IndexStore, filePath: string): void {
  store.files = store.files.filter((f) => f.path !== filePath);
}

export function getFileIndex(store: IndexStore, filePath: string): FileIndex | undefined {
  return store.files.find((f) => f.path === filePath);
}
