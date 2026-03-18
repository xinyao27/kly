import type { FileIndex, IndexStore } from "./types.js";

export interface SearchResult {
  file: FileIndex;
  score: number;
}

export function searchFiles(store: IndexStore, query: string): SearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];

  for (const file of store.files) {
    let score = 0;
    const searchText = [
      file.name,
      file.description,
      file.summary,
      file.path,
      ...file.symbols.map((s) => `${s.name} ${s.description}`),
      ...file.exports,
    ]
      .join(" ")
      .toLowerCase();

    for (const term of terms) {
      if (searchText.includes(term)) {
        score++;

        // Boost for matches in name/path
        if (file.name.toLowerCase().includes(term)) score += 2;
        if (file.path.toLowerCase().includes(term)) score += 1;
        // Boost for symbol name matches
        if (file.symbols.some((s) => s.name.toLowerCase().includes(term))) score += 1;
      }
    }

    if (score > 0) {
      results.push({ file, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function filterByLanguage(store: IndexStore, language: string): FileIndex[] {
  return store.files.filter((f) => f.language === language);
}

export function filterByPath(store: IndexStore, pathPattern: string): FileIndex[] {
  return store.files.filter((f) => f.path.includes(pathPattern));
}
