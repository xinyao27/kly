import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDbDir, getDbPath, initKlyDir } from "../config.js";
import { IndexDatabase } from "../database.js";
import {
  getAllFilesFromDb,
  getBranchState,
  getFileFromDb,
  listBranchDbs,
  loadState,
  openDatabase,
  removeBranchDb,
  saveState,
  setBranchState,
} from "../store.js";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures.js";

describe("store", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    initKlyDir(tmpDir);
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe("openDatabase", () => {
    it("should create a database file", () => {
      const db = openDatabase(tmpDir, "test");
      db.close();
      expect(fs.existsSync(path.join(getDbDir(tmpDir), "test.db"))).toBe(true);
    });
  });

  describe("IndexDatabase", () => {
    let db: IndexDatabase;

    beforeEach(() => {
      db = openDatabase(tmpDir, "test");
    });

    afterEach(() => {
      db.close();
    });

    describe("upsertFile / getFile", () => {
      it("should insert and retrieve a file", () => {
        const fi = createFileIndex({ path: "src/a.ts" });
        db.upsertFile(fi);
        const result = db.getFile("src/a.ts");
        expect(result).toBeDefined();
        expect(result!.path).toBe("src/a.ts");
        expect(result!.name).toBe(fi.name);
        expect(result!.imports).toEqual(fi.imports);
        expect(result!.exports).toEqual(fi.exports);
        expect(result!.symbols).toEqual(fi.symbols);
      });

      it("should update existing file", () => {
        db.upsertFile(createFileIndex({ path: "src/a.ts", name: "Old" }));
        db.upsertFile(createFileIndex({ path: "src/a.ts", name: "New" }));
        const result = db.getFile("src/a.ts");
        expect(result!.name).toBe("New");
        expect(db.getFileCount()).toBe(1);
      });

      it("should return undefined for non-existing file", () => {
        expect(db.getFile("src/nope.ts")).toBeUndefined();
      });
    });

    describe("upsertFiles (batch)", () => {
      it("should insert multiple files in a transaction", () => {
        const files = [
          createFileIndex({ path: "src/a.ts", name: "A" }),
          createFileIndex({ path: "src/b.ts", name: "B" }),
          createFileIndex({ path: "src/c.ts", name: "C" }),
        ];
        db.upsertFiles(files);
        expect(db.getFileCount()).toBe(3);
        expect(db.getFile("src/b.ts")!.name).toBe("B");
      });
    });

    describe("removeFile / removeFiles", () => {
      it("should remove a single file", () => {
        db.upsertFile(createFileIndex({ path: "src/a.ts" }));
        db.removeFile("src/a.ts");
        expect(db.getFile("src/a.ts")).toBeUndefined();
      });

      it("should remove multiple files", () => {
        db.upsertFiles([
          createFileIndex({ path: "src/a.ts" }),
          createFileIndex({ path: "src/b.ts" }),
          createFileIndex({ path: "src/c.ts" }),
        ]);
        db.removeFiles(["src/a.ts", "src/c.ts"]);
        expect(db.getFileCount()).toBe(1);
        expect(db.getFile("src/b.ts")).toBeDefined();
      });

      it("should be a no-op for non-existing file", () => {
        db.upsertFile(createFileIndex({ path: "src/a.ts" }));
        db.removeFile("src/nonexistent.ts");
        expect(db.getFileCount()).toBe(1);
      });
    });

    describe("getAllFiles", () => {
      it("should return all files sorted by path", () => {
        db.upsertFiles([
          createFileIndex({ path: "src/b.ts" }),
          createFileIndex({ path: "src/a.ts" }),
        ]);
        const files = db.getAllFiles();
        expect(files).toHaveLength(2);
        expect(files[0].path).toBe("src/a.ts");
        expect(files[1].path).toBe("src/b.ts");
      });
    });

    describe("getLanguageStats", () => {
      it("should return language counts", () => {
        db.upsertFiles([
          createFileIndex({ path: "a.ts", language: "typescript" }),
          createFileIndex({ path: "b.swift", language: "swift" }),
          createFileIndex({ path: "c.ts", language: "typescript" }),
        ]);
        const stats = db.getLanguageStats();
        expect(stats.typescript).toBe(2);
        expect(stats.swift).toBe(1);
      });
    });

    describe("metadata", () => {
      it("should set and get metadata", () => {
        db.setMetadata("version", "2");
        expect(db.getMetadata("version")).toBe("2");
      });

      it("should return undefined for missing key", () => {
        expect(db.getMetadata("nonexistent")).toBeUndefined();
      });

      it("should update existing metadata", () => {
        db.setMetadata("key", "old");
        db.setMetadata("key", "new");
        expect(db.getMetadata("key")).toBe("new");
      });
    });

    describe("searchFiles (FTS5)", () => {
      it("should find files by description", () => {
        db.upsertFile(
          createFileIndex({
            path: "src/auth.ts",
            name: "AuthService",
            description: "Handles user authentication and login",
          }),
        );
        db.upsertFile(
          createFileIndex({
            path: "src/db.ts",
            name: "Database",
            description: "Manages database connections",
          }),
        );

        const results = db.searchFiles("authentication");
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].file.path).toBe("src/auth.ts");
      });

      it("should return empty array for no match", () => {
        db.upsertFile(createFileIndex());
        const results = db.searchFiles("zzzznonexistent");
        expect(results).toEqual([]);
      });

      it("should return empty array for empty query", () => {
        const results = db.searchFiles("");
        expect(results).toEqual([]);
      });

      it("should respect limit", () => {
        for (let i = 0; i < 10; i++) {
          db.upsertFile(
            createFileIndex({
              path: `src/module${i}.ts`,
              name: `Module ${i}`,
              description: "A shared utility module",
            }),
          );
        }
        const results = db.searchFiles("module", 3);
        expect(results).toHaveLength(3);
      });
    });
  });

  describe("state management", () => {
    it("should save and load state", () => {
      const state = {
        version: 2,
        configHash: "abc123",
        branches: {
          main: { lastCommit: "deadbeef", lastBuilt: 1000 },
        },
      };
      saveState(tmpDir, state);
      const loaded = loadState(tmpDir);
      expect(loaded.version).toBe(2);
      expect(loaded.configHash).toBe("abc123");
      expect(loaded.branches.main.lastCommit).toBe("deadbeef");
    });

    it("should return empty state when no file exists", () => {
      const state = loadState(tmpDir);
      expect(state.version).toBe(2);
      expect(state.branches).toEqual({});
    });

    it("should get and set branch state", () => {
      const state = loadState(tmpDir);
      setBranchState(state, "main", { lastCommit: "abc", lastBuilt: 1000 });
      expect(getBranchState(state, "main")?.lastCommit).toBe("abc");
      expect(getBranchState(state, "nonexistent")).toBeUndefined();
    });
  });

  describe("branch db management", () => {
    it("should list branch dbs", () => {
      openDatabase(tmpDir, "main").close();
      openDatabase(tmpDir, "feature--auth").close();
      const dbs = listBranchDbs(tmpDir);
      expect(dbs).toContain("main");
      expect(dbs).toContain("feature--auth");
    });

    it("should remove a branch db", () => {
      openDatabase(tmpDir, "old-branch").close();
      expect(listBranchDbs(tmpDir)).toContain("old-branch");
      removeBranchDb(tmpDir, "old-branch");
      expect(listBranchDbs(tmpDir)).not.toContain("old-branch");
    });

    it("should return empty array when dbDir does not exist", () => {
      // Use a fresh tmpDir without initKlyDir
      const freshDir = createTempDir();
      expect(listBranchDbs(freshDir)).toEqual([]);
      cleanupTempDir(freshDir);
    });

    it("should handle removeBranchDb when db file does not exist", () => {
      // Should not throw
      removeBranchDb(tmpDir, "nonexistent-branch");
    });

    it("should also remove WAL and SHM files when removing branch db", () => {
      const db = openDatabase(tmpDir, "wal-test");
      db.close();
      const dbPath = getDbPath(tmpDir, "wal-test");
      // Create fake WAL and SHM files
      fs.writeFileSync(dbPath + "-wal", "fake", "utf-8");
      fs.writeFileSync(dbPath + "-shm", "fake", "utf-8");
      expect(fs.existsSync(dbPath + "-wal")).toBe(true);
      expect(fs.existsSync(dbPath + "-shm")).toBe(true);

      removeBranchDb(tmpDir, "wal-test");
      expect(fs.existsSync(dbPath)).toBe(false);
      expect(fs.existsSync(dbPath + "-wal")).toBe(false);
      expect(fs.existsSync(dbPath + "-shm")).toBe(false);
    });
  });

  describe("convenience wrappers", () => {
    it("getFileFromDb should return a file from the default db", () => {
      const db = openDatabase(tmpDir, "default");
      db.upsertFile(createFileIndex({ path: "src/a.ts", name: "A" }));
      db.close();

      const result = getFileFromDb(tmpDir, "src/a.ts");
      expect(result).toBeDefined();
      expect(result!.name).toBe("A");
    });

    it("getFileFromDb should return undefined for non-existing file", () => {
      openDatabase(tmpDir, "default").close();
      expect(getFileFromDb(tmpDir, "src/nope.ts")).toBeUndefined();
    });

    it("getAllFilesFromDb should return all files from default db", () => {
      const db = openDatabase(tmpDir, "default");
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts" }),
        createFileIndex({ path: "src/b.ts" }),
      ]);
      db.close();

      const files = getAllFilesFromDb(tmpDir);
      expect(files).toHaveLength(2);
    });
  });

  describe("openDatabase without existing dbDir", () => {
    it("should create dbDir if it does not exist", () => {
      // Remove the db dir that initKlyDir created
      const dbDir = getDbDir(tmpDir);
      fs.rmSync(dbDir, { recursive: true, force: true });
      expect(fs.existsSync(dbDir)).toBe(false);

      const db = openDatabase(tmpDir, "test");
      db.close();
      expect(fs.existsSync(dbDir)).toBe(true);
    });
  });
});
