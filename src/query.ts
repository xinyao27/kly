import type { IndexDatabase, SearchResult } from "./database.js";
import type { FileIndex } from "./types.js";

export type { SearchResult } from "./database.js";

export function searchFiles(db: IndexDatabase, query: string, limit = 20): SearchResult[] {
  return db.searchFiles(query, limit);
}

export function filterByLanguage(db: IndexDatabase, language: string): FileIndex[] {
  return db.getAllFiles().filter((f) => f.language === language);
}

export function filterByPath(db: IndexDatabase, pathPattern: string): FileIndex[] {
  return db.getAllFiles().filter((f) => f.path.includes(pathPattern));
}
