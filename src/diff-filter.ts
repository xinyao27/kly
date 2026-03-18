import picomatch from "picomatch";

import type { GitDiff, KlyConfig } from "./types";

export interface FilteredDiff {
  toIndex: string[];
  toDelete: string[];
  renamed: Array<{ from: string; to: string }>;
}

export function filterGitDiff(diff: GitDiff, config: KlyConfig): FilteredDiff {
  const isIncluded = picomatch(config.include);
  const isExcluded = picomatch(config.exclude);

  const matches = (filePath: string): boolean => isIncluded(filePath) && !isExcluded(filePath);

  const toIndex: string[] = [];
  const toDelete: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];

  for (const filePath of [...diff.added, ...diff.modified]) {
    if (matches(filePath)) {
      toIndex.push(filePath);
    }
  }

  for (const filePath of diff.deleted) {
    if (matches(filePath)) {
      toDelete.push(filePath);
    }
  }

  for (const r of diff.renamed) {
    const fromMatches = matches(r.from);
    const toMatches = matches(r.to);

    if (toMatches) {
      renamed.push(r);
    }
    if (fromMatches && !toMatches) {
      toDelete.push(r.from);
    }
  }

  return { toIndex, toDelete, renamed };
}
