import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calculateRepoHash, compareHashes, parseHashString } from "../integrity";

describe("integrity", () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for each test
    testDir = mkdtempSync(join(tmpdir(), "kly-test-"));
  });

  afterEach(() => {
    // Cleanup
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("calculateRepoHash", () => {
    test("calculates consistent hash for same content", () => {
      // Create test files
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      writeFileSync(join(testDir, "utils.ts"), 'export function greet() { return "hello"; }');

      const hash1 = calculateRepoHash(testDir);
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sha384-/);
    });

    test("changes hash when content changes", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      writeFileSync(join(testDir, "index.ts"), 'export const foo = "baz";');
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).not.toBe(hash2);
    });

    test("changes hash when new file added", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      writeFileSync(join(testDir, "new.ts"), 'export const bar = "baz";');
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).not.toBe(hash2);
    });

    test("ignores node_modules", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      mkdirSync(join(testDir, "node_modules"));
      writeFileSync(join(testDir, "node_modules", "lib.js"), "// This should be ignored");
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).toBe(hash2);
    });

    test("ignores .git directory", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      mkdirSync(join(testDir, ".git"));
      writeFileSync(join(testDir, ".git", "config"), "// Git config");
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).toBe(hash2);
    });

    test("ignores dist and build directories", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      mkdirSync(join(testDir, "dist"));
      writeFileSync(join(testDir, "dist", "index.js"), "// Built file");

      mkdirSync(join(testDir, "build"));
      writeFileSync(join(testDir, "build", "output.js"), "// Built file");

      const hash2 = calculateRepoHash(testDir);

      expect(hash1).toBe(hash2);
    });

    test("ignores log files", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      writeFileSync(join(testDir, "debug.log"), "// Log content");
      writeFileSync(join(testDir, "error.log"), "// Error log");
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).toBe(hash2);
    });

    test("includes JSON files", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "test" }));
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).not.toBe(hash2);
    });

    test("includes markdown files", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      writeFileSync(join(testDir, "README.md"), "# Test Project");
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).not.toBe(hash2);
    });

    test("includes bun.lockb if present", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      // Create a dummy lock file
      writeFileSync(join(testDir, "bun.lockb"), Buffer.from([0x01, 0x02, 0x03]));
      const hash2 = calculateRepoHash(testDir);

      expect(hash1).not.toBe(hash2);
    });

    test("detects file renames (path changes)", () => {
      writeFileSync(join(testDir, "old.ts"), 'export const foo = "bar";');
      const hash1 = calculateRepoHash(testDir);

      rmSync(join(testDir, "old.ts"));
      writeFileSync(join(testDir, "new.ts"), 'export const foo = "bar";');
      const hash2 = calculateRepoHash(testDir);

      // Same content, different path = different hash
      expect(hash1).not.toBe(hash2);
    });

    test("handles nested directories", () => {
      mkdirSync(join(testDir, "src"));
      mkdirSync(join(testDir, "src", "utils"));

      writeFileSync(join(testDir, "src", "index.ts"), "export const main = 1;");
      writeFileSync(join(testDir, "src", "utils", "helpers.ts"), "export const helper = 2;");

      const hash = calculateRepoHash(testDir);

      expect(hash).toMatch(/^sha384-/);
      expect(hash.length).toBeGreaterThan(50);
    });

    test("uses sha256 algorithm when specified", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');

      const hash = calculateRepoHash(testDir, "sha256");

      expect(hash).toMatch(/^sha256-/);
    });

    test("uses sha512 algorithm when specified", () => {
      writeFileSync(join(testDir, "index.ts"), 'export const foo = "bar";');

      const hash = calculateRepoHash(testDir, "sha512");

      expect(hash).toMatch(/^sha512-/);
    });
  });

  describe("parseHashString", () => {
    test("parses valid sha384 hash", () => {
      const result = parseHashString("sha384-oqVuAfXRKap7fdgcCY5uykM6");

      expect(result).toEqual({
        algorithm: "sha384",
        digest: "oqVuAfXRKap7fdgcCY5uykM6",
      });
    });

    test("parses valid sha256 hash", () => {
      const result = parseHashString("sha256-abcdefgh123456");

      expect(result).toEqual({
        algorithm: "sha256",
        digest: "abcdefgh123456",
      });
    });

    test("parses valid sha512 hash", () => {
      const result = parseHashString("sha512-xyz789");

      expect(result).toEqual({
        algorithm: "sha512",
        digest: "xyz789",
      });
    });

    test("returns null for invalid format", () => {
      expect(parseHashString("invalid-hash")).toBeNull();
      expect(parseHashString("sha384")).toBeNull();
      expect(parseHashString("md5-abc123")).toBeNull();
      expect(parseHashString("")).toBeNull();
    });
  });

  describe("compareHashes", () => {
    test("returns true for identical hashes", () => {
      const hash1 = "sha384-oqVuAfXRKap7fdgcCY5uykM6";
      const hash2 = "sha384-oqVuAfXRKap7fdgcCY5uykM6";

      expect(compareHashes(hash1, hash2)).toBe(true);
    });

    test("returns false for different hashes", () => {
      const hash1 = "sha384-oqVuAfXRKap7fdgcCY5uykM6";
      const hash2 = "sha384-DifferentHashValue123456";

      expect(compareHashes(hash1, hash2)).toBe(false);
    });

    test("returns false for different algorithms", () => {
      const hash1 = "sha256-abc123";
      const hash2 = "sha384-abc123";

      expect(compareHashes(hash1, hash2)).toBe(false);
    });

    test("returns false for invalid hashes", () => {
      expect(compareHashes("invalid", "sha384-valid")).toBe(false);
      expect(compareHashes("sha384-valid", "invalid")).toBe(false);
      expect(compareHashes("invalid1", "invalid2")).toBe(false);
    });
  });
});
