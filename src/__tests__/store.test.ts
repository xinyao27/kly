import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initKlyDir } from "../config.js";
import {
  createEmptyStore,
  getFileIndex,
  loadStore,
  removeFileIndex,
  saveStore,
  upsertFileIndex,
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

  describe("createEmptyStore", () => {
    it("should return store with version 1 and empty files", () => {
      const store = createEmptyStore();
      expect(store.version).toBe(1);
      expect(store.files).toEqual([]);
      expect(store.generatedAt).toBeGreaterThan(0);
    });
  });

  describe("upsertFileIndex", () => {
    it("should insert new file index", () => {
      const store = createEmptyStore();
      const fileIndex = createFileIndex({ path: "src/a.ts" });
      upsertFileIndex(store, fileIndex);
      expect(store.files).toHaveLength(1);
      expect(store.files[0].path).toBe("src/a.ts");
    });

    it("should update existing file index", () => {
      const store = createEmptyStore();
      upsertFileIndex(store, createFileIndex({ path: "src/a.ts", name: "Old" }));
      upsertFileIndex(store, createFileIndex({ path: "src/a.ts", name: "New" }));
      expect(store.files).toHaveLength(1);
      expect(store.files[0].name).toBe("New");
    });

    it("should not produce duplicates", () => {
      const store = createEmptyStore();
      const fi = createFileIndex({ path: "src/x.ts" });
      upsertFileIndex(store, fi);
      upsertFileIndex(store, fi);
      upsertFileIndex(store, fi);
      expect(store.files).toHaveLength(1);
    });
  });

  describe("removeFileIndex", () => {
    it("should remove existing file", () => {
      const store = createEmptyStore();
      upsertFileIndex(store, createFileIndex({ path: "src/a.ts" }));
      removeFileIndex(store, "src/a.ts");
      expect(store.files).toHaveLength(0);
    });

    it("should be a no-op for non-existing file", () => {
      const store = createEmptyStore();
      upsertFileIndex(store, createFileIndex({ path: "src/a.ts" }));
      removeFileIndex(store, "src/nonexistent.ts");
      expect(store.files).toHaveLength(1);
    });
  });

  describe("getFileIndex", () => {
    it("should find existing file", () => {
      const store = createEmptyStore();
      upsertFileIndex(store, createFileIndex({ path: "src/target.ts" }));
      const result = getFileIndex(store, "src/target.ts");
      expect(result).toBeDefined();
      expect(result!.path).toBe("src/target.ts");
    });

    it("should return undefined for non-existing file", () => {
      const store = createEmptyStore();
      expect(getFileIndex(store, "src/nope.ts")).toBeUndefined();
    });
  });

  describe("saveStore / loadStore roundtrip", () => {
    it("should persist and restore store data", () => {
      const store = createEmptyStore();
      upsertFileIndex(store, createFileIndex({ path: "src/a.ts", name: "Module A" }));
      upsertFileIndex(store, createFileIndex({ path: "src/b.ts", name: "Module B" }));

      saveStore(tmpDir, store);
      const loaded = loadStore(tmpDir);

      expect(loaded.version).toBe(1);
      expect(loaded.files).toHaveLength(2);
      expect(loaded.files[0].path).toBe("src/a.ts");
      expect(loaded.files[0].name).toBe("Module A");
      expect(loaded.files[1].path).toBe("src/b.ts");
    });

    it("should return empty store when index file does not exist", () => {
      // tmpDir has .kly dir but no index.yaml
      const store = loadStore(tmpDir);
      expect(store.version).toBe(1);
      expect(store.files).toEqual([]);
    });
  });
});
