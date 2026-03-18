import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashFile, hasChanged } from "../hasher";
import { cleanupTempDir, createTempDir, writeFile } from "./helpers/fixtures";

describe("hasher", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe("hashFile", () => {
    it("should return a 64-character hex string", () => {
      writeFile(tmpDir, "test.ts", "const x = 1;");
      const hash = hashFile(tmpDir, "test.ts");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should return the same hash for the same content", () => {
      writeFile(tmpDir, "a.ts", "hello world");
      writeFile(tmpDir, "b.ts", "hello world");
      expect(hashFile(tmpDir, "a.ts")).toBe(hashFile(tmpDir, "b.ts"));
    });

    it("should return different hashes for different content", () => {
      writeFile(tmpDir, "a.ts", "hello");
      writeFile(tmpDir, "b.ts", "world");
      expect(hashFile(tmpDir, "a.ts")).not.toBe(hashFile(tmpDir, "b.ts"));
    });
  });

  describe("hasChanged", () => {
    it("should return true when hashes differ", () => {
      expect(hasChanged("aaa", "bbb")).toBe(true);
    });

    it("should return false when hashes are the same", () => {
      expect(hasChanged("aaa", "aaa")).toBe(false);
    });
  });
});
