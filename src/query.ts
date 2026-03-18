import type { Api, Model } from "@mariozechner/pi-ai";

import type { IndexDatabase, SearchResult } from "./database";
import { rerankResults } from "./llm/reranker";
import type { FileIndex } from "./types";

export type { SearchResult } from "./database";

export function searchFiles(db: IndexDatabase, query: string, limit = 20): SearchResult[] {
  return db.searchFiles(query, limit);
}

export async function searchFilesWithRerank(
  db: IndexDatabase,
  model: Model<Api>,
  query: string,
  topK = 10,
): Promise<SearchResult[]> {
  // Fetch more candidates for reranking
  const candidates = db.searchFiles(query, 50);
  if (candidates.length === 0) return [];

  return rerankResults(model, query, candidates, topK);
}

export function filterByLanguage(db: IndexDatabase, language: string): FileIndex[] {
  return db.getAllFiles().filter((f) => f.language === language);
}

export function filterByPath(db: IndexDatabase, pathPattern: string): FileIndex[] {
  return db.getAllFiles().filter((f) => f.path.includes(pathPattern));
}
