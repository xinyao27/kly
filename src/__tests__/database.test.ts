import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initKlyDir, getDbDir } from "../config.js";
import { IndexDatabase } from "../database.js";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures.js";

describe("IndexDatabase", () => {
  let tmpDir: string;
  let db: IndexDatabase;

  beforeEach(() => {
    tmpDir = createTempDir();
    initKlyDir(tmpDir);
    db = new IndexDatabase(path.join(getDbDir(tmpDir), "test.db"));
  });

  afterEach(() => {
    db.close();
    cleanupTempDir(tmpDir);
  });

  it("should create tables on init", () => {
    // If we get here without error, tables were created successfully
    expect(db.getFileCount()).toBe(0);
  });

  describe("CRUD operations", () => {
    it("should upsert and get a file", () => {
      const fi = createFileIndex({ path: "src/a.ts" });
      db.upsertFile(fi);
      const result = db.getFile("src/a.ts");
      expect(result).toBeDefined();
      expect(result!.path).toBe("src/a.ts");
      expect(result!.language).toBe("typescript");
      expect(result!.imports).toEqual(["fs"]);
      expect(result!.exports).toEqual(["example"]);
      expect(result!.symbols).toEqual([
        { name: "example", kind: "function", description: "An example function" },
      ]);
    });

    it("should upsert multiple files in transaction", () => {
      db.upsertFiles([
        createFileIndex({ path: "a.ts" }),
        createFileIndex({ path: "b.ts" }),
        createFileIndex({ path: "c.ts" }),
      ]);
      expect(db.getFileCount()).toBe(3);
    });

    it("should remove files", () => {
      db.upsertFiles([createFileIndex({ path: "a.ts" }), createFileIndex({ path: "b.ts" })]);
      db.removeFile("a.ts");
      expect(db.getFileCount()).toBe(1);
      expect(db.getFile("a.ts")).toBeUndefined();
    });

    it("should remove multiple files", () => {
      db.upsertFiles([
        createFileIndex({ path: "a.ts" }),
        createFileIndex({ path: "b.ts" }),
        createFileIndex({ path: "c.ts" }),
      ]);
      db.removeFiles(["a.ts", "c.ts"]);
      expect(db.getFileCount()).toBe(1);
    });
  });

  describe("FTS5 search", () => {
    it("should find by name", () => {
      db.upsertFile(createFileIndex({ path: "src/auth.ts", name: "AuthService" }));
      const results = db.searchFiles("AuthService");
      expect(results).toHaveLength(1);
      expect(results[0].file.name).toBe("AuthService");
    });

    it("should find by description", () => {
      db.upsertFile(
        createFileIndex({
          path: "src/auth.ts",
          description: "Authentication middleware for Express",
        }),
      );
      const results = db.searchFiles("middleware");
      expect(results).toHaveLength(1);
    });

    it("should find by summary", () => {
      db.upsertFile(
        createFileIndex({
          path: "src/db.ts",
          summary: "Handles PostgreSQL connection pooling",
        }),
      );
      const results = db.searchFiles("PostgreSQL");
      expect(results).toHaveLength(1);
    });

    it("should return empty for no match", () => {
      db.upsertFile(createFileIndex({ path: "src/a.ts" }));
      expect(db.searchFiles("xyznonexistent")).toEqual([]);
    });

    it("should return empty for empty query", () => {
      expect(db.searchFiles("")).toEqual([]);
    });

    it("should handle special characters in query", () => {
      db.upsertFile(createFileIndex({ path: "src/a.ts", name: "test" }));
      // Should not throw
      const results = db.searchFiles('test "quotes"');
      expect(results).toBeDefined();
    });
  });

  describe("metadata", () => {
    it("should store and retrieve metadata", () => {
      db.setMetadata("version", "2");
      db.setMetadata("base_commit", "abc123");
      expect(db.getMetadata("version")).toBe("2");
      expect(db.getMetadata("base_commit")).toBe("abc123");
    });

    it("should overwrite existing metadata", () => {
      db.setMetadata("key", "old");
      db.setMetadata("key", "new");
      expect(db.getMetadata("key")).toBe("new");
    });
  });

  describe("stats", () => {
    it("should count files", () => {
      db.upsertFiles([createFileIndex({ path: "a.ts" }), createFileIndex({ path: "b.ts" })]);
      expect(db.getFileCount()).toBe(2);
    });

    it("should get language stats", () => {
      db.upsertFiles([
        createFileIndex({ path: "a.ts", language: "typescript" }),
        createFileIndex({ path: "b.ts", language: "typescript" }),
        createFileIndex({ path: "c.swift", language: "swift" }),
      ]);
      const stats = db.getLanguageStats();
      expect(stats).toEqual({ typescript: 2, swift: 1 });
    });
  });
});
