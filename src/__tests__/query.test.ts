import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initKlyDir } from "../config.js";
import { IndexDatabase } from "../database.js";
import { filterByLanguage, filterByPath, searchFiles } from "../query.js";
import { openDatabase } from "../store.js";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures.js";

describe("query", () => {
  let tmpDir: string;
  let db: IndexDatabase;

  beforeEach(() => {
    tmpDir = createTempDir();
    initKlyDir(tmpDir);
    db = openDatabase(tmpDir, "test");
  });

  afterEach(() => {
    db.close();
    cleanupTempDir(tmpDir);
  });

  describe("searchFiles (FTS5)", () => {
    it("should return empty array for empty db", () => {
      expect(searchFiles(db, "anything")).toEqual([]);
    });

    it("should return empty array when no match found", () => {
      db.upsertFile(createFileIndex());
      expect(searchFiles(db, "zzzznonexistent")).toEqual([]);
    });

    it("should match by name", () => {
      db.upsertFile(createFileIndex({ path: "src/auth.ts", name: "AuthService" }));
      const results = searchFiles(db, "AuthService");
      expect(results).toHaveLength(1);
      expect(results[0].file.name).toBe("AuthService");
    });

    it("should match by description", () => {
      db.upsertFile(
        createFileIndex({
          path: "src/auth.ts",
          description: "Handles user authentication",
        }),
      );
      const results = searchFiles(db, "authentication");
      expect(results).toHaveLength(1);
    });

    it("should match by summary", () => {
      db.upsertFile(
        createFileIndex({
          path: "src/db.ts",
          summary: "This module manages database connections",
        }),
      );
      const results = searchFiles(db, "database");
      expect(results).toHaveLength(1);
    });

    it("should match by path", () => {
      db.upsertFile(createFileIndex({ path: "src/utils/logger.ts" }));
      const results = searchFiles(db, "logger");
      expect(results).toHaveLength(1);
    });

    it("should respect limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        db.upsertFile(
          createFileIndex({
            path: `src/mod${i}.ts`,
            name: `Module${i}`,
            description: "shared utility module",
          }),
        );
      }
      const results = searchFiles(db, "module", 3);
      expect(results).toHaveLength(3);
    });

    it("should sort results by relevance score", () => {
      db.upsertFile(
        createFileIndex({
          path: "src/low.ts",
          name: "Low",
          description: "mentions auth once",
          summary: "",
        }),
      );
      db.upsertFile(
        createFileIndex({
          path: "src/auth.ts",
          name: "auth",
          description: "auth module for authentication",
          summary: "auth system",
        }),
      );
      const results = searchFiles(db, "auth");
      expect(results.length).toBeGreaterThan(0);
      // The more relevant one should score higher
      expect(results[0].file.path).toBe("src/auth.ts");
    });
  });

  describe("filterByLanguage", () => {
    it("should filter files by language", () => {
      db.upsertFiles([
        createFileIndex({ path: "a.ts", language: "typescript" }),
        createFileIndex({ path: "b.swift", language: "swift" }),
        createFileIndex({ path: "c.ts", language: "typescript" }),
      ]);
      const result = filterByLanguage(db, "typescript");
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.language === "typescript")).toBe(true);
    });
  });

  describe("filterByPath", () => {
    it("should filter files by path pattern", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/utils/a.ts" }),
        createFileIndex({ path: "src/core/b.ts" }),
        createFileIndex({ path: "src/utils/c.ts" }),
      ]);
      const result = filterByPath(db, "utils");
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.path.includes("utils"))).toBe(true);
    });
  });
});
