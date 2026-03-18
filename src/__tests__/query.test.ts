import { describe, expect, it } from "vitest";

import { filterByLanguage, filterByPath, searchFiles } from "../query.js";
import { createFileIndex, createStore } from "./helpers/fixtures.js";

describe("query", () => {
  describe("searchFiles", () => {
    it("should return empty array for empty store", () => {
      const store = createStore();
      expect(searchFiles(store, "anything")).toEqual([]);
    });

    it("should return empty array when no match found", () => {
      const store = createStore([createFileIndex()]);
      expect(searchFiles(store, "zzzznonexistent")).toEqual([]);
    });

    it("should match by name", () => {
      const store = createStore([createFileIndex({ name: "AuthService" })]);
      const results = searchFiles(store, "authservice");
      expect(results).toHaveLength(1);
      expect(results[0].file.name).toBe("AuthService");
    });

    it("should match by description", () => {
      const store = createStore([createFileIndex({ description: "Handles user authentication" })]);
      const results = searchFiles(store, "authentication");
      expect(results).toHaveLength(1);
    });

    it("should match by summary", () => {
      const store = createStore([
        createFileIndex({ summary: "This module manages database connections" }),
      ]);
      const results = searchFiles(store, "database");
      expect(results).toHaveLength(1);
    });

    it("should match by symbol name", () => {
      const store = createStore([
        createFileIndex({
          symbols: [{ name: "fetchUser", kind: "function", description: "Fetches a user" }],
        }),
      ]);
      const results = searchFiles(store, "fetchuser");
      expect(results).toHaveLength(1);
    });

    it("should match by export name", () => {
      const store = createStore([createFileIndex({ exports: ["parseConfig"] })]);
      const results = searchFiles(store, "parseconfig");
      expect(results).toHaveLength(1);
    });

    it("should match by path", () => {
      const store = createStore([createFileIndex({ path: "src/utils/logger.ts" })]);
      const results = searchFiles(store, "logger");
      expect(results).toHaveLength(1);
    });

    it("should boost name matches (+2)", () => {
      const nameMatch = createFileIndex({
        path: "src/other.ts",
        name: "auth",
        description: "unrelated",
      });
      const descMatch = createFileIndex({
        path: "src/desc.ts",
        name: "unrelated",
        description: "auth module",
      });
      const store = createStore([descMatch, nameMatch]);
      const results = searchFiles(store, "auth");
      // name match should score higher
      expect(results[0].file.name).toBe("auth");
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it("should boost path matches (+1)", () => {
      const pathMatch = createFileIndex({
        path: "src/auth/index.ts",
        name: "Index",
        description: "entry for auth",
      });
      const noPathMatch = createFileIndex({
        path: "src/other/index.ts",
        name: "Other",
        description: "entry for auth",
      });
      const store = createStore([noPathMatch, pathMatch]);
      const results = searchFiles(store, "auth");
      expect(results[0].file.path).toBe("src/auth/index.ts");
    });

    it("should boost symbol name matches (+1)", () => {
      const symbolMatch = createFileIndex({
        path: "src/a.ts",
        name: "A",
        description: "has login",
        symbols: [{ name: "login", kind: "function", description: "does login" }],
      });
      const noSymbolMatch = createFileIndex({
        path: "src/b.ts",
        name: "B",
        description: "has login mention",
        symbols: [{ name: "other", kind: "function", description: "something else" }],
      });
      const store = createStore([noSymbolMatch, symbolMatch]);
      const results = searchFiles(store, "login");
      expect(results[0].file.path).toBe("src/a.ts");
    });

    it("should accumulate scores for multi-word queries", () => {
      const store = createStore([
        createFileIndex({
          path: "src/auth.ts",
          name: "AuthService",
          description: "Authentication service module",
        }),
      ]);
      const singleResult = searchFiles(store, "auth");
      const multiResult = searchFiles(store, "auth service");
      expect(multiResult[0].score).toBeGreaterThan(singleResult[0].score);
    });

    it("should sort results by score descending", () => {
      const store = createStore([
        createFileIndex({ path: "src/low.ts", name: "Low", description: "auth" }),
        createFileIndex({
          path: "src/auth.ts",
          name: "auth",
          description: "auth module",
          summary: "auth",
        }),
      ]);
      const results = searchFiles(store, "auth");
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });
  });

  describe("filterByLanguage", () => {
    it("should filter files by language", () => {
      const store = createStore([
        createFileIndex({ path: "a.ts", language: "typescript" }),
        createFileIndex({ path: "b.swift", language: "swift" }),
        createFileIndex({ path: "c.ts", language: "typescript" }),
      ]);
      const result = filterByLanguage(store, "typescript");
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.language === "typescript")).toBe(true);
    });
  });

  describe("filterByPath", () => {
    it("should filter files by path pattern", () => {
      const store = createStore([
        createFileIndex({ path: "src/utils/a.ts" }),
        createFileIndex({ path: "src/core/b.ts" }),
        createFileIndex({ path: "src/utils/c.ts" }),
      ]);
      const result = filterByPath(store, "utils");
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.path.includes("utils"))).toBe(true);
    });
  });
});
