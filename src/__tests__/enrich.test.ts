import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initKlyDir } from "../config";
import { enrichErrorStack } from "../enrich";
import { openDatabase } from "../store";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures";

// Mock git to avoid real subprocess calls
vi.mock("../git", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../git")>();
  return {
    ...actual,
    getFileHistory: vi.fn((_root: string, filePath: string) => {
      if (filePath === "src/auth.ts") {
        return [
          {
            hash: "abc1234",
            author: "alice",
            email: "alice@example.com",
            date: 1711368600,
            message: "fix: auth token validation",
          },
          {
            hash: "def5678",
            author: "bob",
            email: "bob@example.com",
            date: 1711282200,
            message: "feat: add refresh token",
          },
        ];
      }
      return [];
    }),
  };
});

describe("enrichErrorStack", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    initKlyDir(tmpDir);
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("enriches frames with file index data", () => {
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(
      createFileIndex({
        path: "src/auth.ts",
        description: "Authentication service",
        summary: "Handles login and token validation",
        symbols: [
          { name: "validate", kind: "function", description: "Validates JWT token" },
        ],
      }),
    );
    db.close();

    const db2 = openDatabase(tmpDir, "default");
    try {
      const result = enrichErrorStack(db2, tmpDir, [
        { file: "src/auth.ts", line: 42, function: "validate" },
      ]);

      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].fileDescription).toBe("Authentication service");
      expect(result.frames[0].fileSummary).toBe("Handles login and token validation");
      expect(result.frames[0].symbols).toHaveLength(1);
      expect(result.frames[0].language).toBe("typescript");
      expect(result.frames[0].lastModified?.hash).toBe("abc1234");
      expect(result.frames[0].recentCommits).toHaveLength(2);
    } finally {
      db2.close();
    }
  });

  it("enriches frames with dependency data", () => {
    const db = openDatabase(tmpDir, "default");
    db.upsertFiles([
      createFileIndex({ path: "src/auth.ts" }),
      createFileIndex({ path: "src/middleware.ts" }),
      createFileIndex({ path: "src/types.ts" }),
    ]);
    db.upsertDependencies("src/middleware.ts", ["src/auth.ts"]);
    db.upsertDependencies("src/auth.ts", ["src/types.ts"]);
    db.close();

    const db2 = openDatabase(tmpDir, "default");
    try {
      const result = enrichErrorStack(db2, tmpDir, [
        { file: "src/auth.ts", line: 10 },
      ]);

      expect(result.frames[0].importedBy).toEqual(["src/middleware.ts"]);
      expect(result.frames[0].importsFrom).toEqual(["src/types.ts"]);
      expect(result.affectedFiles).toBe(1);
    } finally {
      db2.close();
    }
  });

  it("handles frames for files not in index", () => {
    const db = openDatabase(tmpDir, "default");
    try {
      const result = enrichErrorStack(db, tmpDir, [
        { file: "src/unknown.ts", line: 1 },
      ]);

      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].fileDescription).toBe("");
      expect(result.frames[0].fileSummary).toBe("");
      expect(result.frames[0].symbols).toEqual([]);
      expect(result.frames[0].importedBy).toEqual([]);
      expect(result.frames[0].importsFrom).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("deduplicates affected files across frames", () => {
    const db = openDatabase(tmpDir, "default");
    db.upsertFiles([
      createFileIndex({ path: "src/a.ts" }),
      createFileIndex({ path: "src/b.ts" }),
      createFileIndex({ path: "src/c.ts" }),
    ]);
    // c imports both a and b
    db.upsertDependencies("src/c.ts", ["src/a.ts", "src/b.ts"]);
    db.close();

    const db2 = openDatabase(tmpDir, "default");
    try {
      const result = enrichErrorStack(db2, tmpDir, [
        { file: "src/a.ts", line: 1 },
        { file: "src/b.ts", line: 2 },
      ]);

      // src/c.ts imports both, but should be counted once
      expect(result.affectedFiles).toBe(1);
    } finally {
      db2.close();
    }
  });
});
