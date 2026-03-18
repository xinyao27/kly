import { describe, expect, it } from "vitest";

import { filterGitDiff } from "../diff-filter.js";
import type { GitDiff, KlyConfig } from "../types.js";

const config: KlyConfig = {
  llm: { provider: "test", model: "test", apiKey: "" },
  include: ["**/*.ts", "**/*.tsx"],
  exclude: ["**/node_modules/**", "**/*.test.*"],
};

describe("diff-filter", () => {
  it("should filter added and modified files by include/exclude", () => {
    const diff: GitDiff = {
      added: ["src/auth.ts", "src/auth.test.ts", "src/readme.md"],
      modified: ["src/db.ts", "node_modules/pkg/index.ts"],
      deleted: [],
      renamed: [],
    };

    const result = filterGitDiff(diff, config);
    expect(result.toIndex).toEqual(["src/auth.ts", "src/db.ts"]);
    expect(result.toDelete).toEqual([]);
  });

  it("should filter deleted files", () => {
    const diff: GitDiff = {
      added: [],
      modified: [],
      deleted: ["src/old.ts", "docs/old.md"],
      renamed: [],
    };

    const result = filterGitDiff(diff, config);
    expect(result.toDelete).toEqual(["src/old.ts"]);
  });

  it("should handle renamed files", () => {
    const diff: GitDiff = {
      added: [],
      modified: [],
      deleted: [],
      renamed: [{ from: "src/old.ts", to: "src/new.ts" }],
    };

    const result = filterGitDiff(diff, config);
    expect(result.renamed).toEqual([{ from: "src/old.ts", to: "src/new.ts" }]);
  });

  it("should delete old path when renamed out of scope", () => {
    const diff: GitDiff = {
      added: [],
      modified: [],
      deleted: [],
      renamed: [{ from: "src/old.ts", to: "docs/readme.md" }],
    };

    const result = filterGitDiff(diff, config);
    expect(result.renamed).toEqual([]);
    expect(result.toDelete).toEqual(["src/old.ts"]);
  });

  it("should handle empty diff", () => {
    const diff: GitDiff = { added: [], modified: [], deleted: [], renamed: [] };
    const result = filterGitDiff(diff, config);
    expect(result.toIndex).toEqual([]);
    expect(result.toDelete).toEqual([]);
    expect(result.renamed).toEqual([]);
  });
});
