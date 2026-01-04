import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SumFileManager } from "../sumfile";

describe("SumFileManager", () => {
  let testDir: string;
  let testSumFile: string;

  beforeEach(() => {
    // Create temp directory for each test
    testDir = mkdtempSync(join(tmpdir(), "kly-test-"));
    testSumFile = join(testDir, "kly.sum");
  });

  afterEach(() => {
    // Cleanup
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor and load", () => {
    test("creates manager with custom path", () => {
      const manager = new SumFileManager(testSumFile);
      expect(manager.getAll()).toEqual([]);
    });

    test("loads existing sum file", () => {
      // Create a sum file manually
      const content = [
        "# kly.sum - Integrity verification database",
        "github.com/user/repo@v1.0.0 sha384-ABC123 1704067200 trusted",
        "github.com/user/tool@main sha384-XYZ789 1704070800 untrusted",
      ].join("\n");

      // Write to temp directory and ensure it exists
      const fs = require("node:fs");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testSumFile, content);

      const manager = new SumFileManager(testSumFile);
      const entries = manager.getAll();

      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({
        url: "github.com/user/repo@v1.0.0",
        hash: "sha384-ABC123",
        timestamp: 1704067200,
        trusted: true,
      });
      expect(entries[1]).toEqual({
        url: "github.com/user/tool@main",
        hash: "sha384-XYZ789",
        timestamp: 1704070800,
        trusted: false,
      });
    });

    test("ignores empty lines and comments", () => {
      const content = [
        "# Comment line",
        "",
        "github.com/user/repo@v1.0.0 sha384-ABC123 1704067200 trusted",
        "",
        "# Another comment",
        "github.com/user/tool@main sha384-XYZ789 1704070800 untrusted",
      ].join("\n");

      const fs = require("node:fs");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testSumFile, content);

      const manager = new SumFileManager(testSumFile);
      expect(manager.getAll()).toHaveLength(2);
    });

    test("handles malformed lines gracefully", () => {
      const content = [
        "github.com/user/repo@v1.0.0 sha384-ABC123 1704067200 trusted",
        "invalid line without enough parts",
        "github.com/user/tool@main sha384-XYZ789 1704070800 untrusted",
      ].join("\n");

      const fs = require("node:fs");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testSumFile, content);

      const manager = new SumFileManager(testSumFile);
      expect(manager.getAll()).toHaveLength(2);
    });
  });

  describe("verify", () => {
    test("returns 'new' for unknown URL", () => {
      const manager = new SumFileManager(testSumFile);
      const result = manager.verify("github.com/user/repo@v1.0.0", "sha384-ABC");

      expect(result).toBe("new");
    });

    test("returns 'ok' for matching hash", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", true);

      const result = manager.verify("github.com/user/repo@v1.0.0", "sha384-ABC123");

      expect(result).toBe("ok");
    });

    test("returns 'mismatch' for different hash", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", true);

      const result = manager.verify("github.com/user/repo@v1.0.0", "sha384-DIFFERENT");

      expect(result).toBe("mismatch");
    });
  });

  describe("add", () => {
    test("adds new entry", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", true);

      const entry = manager.get("github.com/user/repo@v1.0.0");
      expect(entry).toBeDefined();
      expect(entry?.url).toBe("github.com/user/repo@v1.0.0");
      expect(entry?.hash).toBe("sha384-ABC123");
      expect(entry?.trusted).toBe(true);
    });

    test("saves to file after adding", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", true);

      expect(existsSync(testSumFile)).toBe(true);

      const content = readFileSync(testSumFile, "utf-8");
      expect(content).toContain("github.com/user/repo@v1.0.0");
      expect(content).toContain("sha384-ABC123");
      expect(content).toContain("trusted");
    });

    test("adds untrusted entry", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", false);

      const entry = manager.get("github.com/user/repo@v1.0.0");
      expect(entry?.trusted).toBe(false);

      const content = readFileSync(testSumFile, "utf-8");
      expect(content).toContain("untrusted");
    });
  });

  describe("update", () => {
    test("updates existing entry hash", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-OLD", true);

      manager.update("github.com/user/repo@v1.0.0", "sha384-NEW", true);

      const entry = manager.get("github.com/user/repo@v1.0.0");
      expect(entry?.hash).toBe("sha384-NEW");
    });

    test("preserves original timestamp on update", async () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-OLD", true);

      const originalEntry = manager.get("github.com/user/repo@v1.0.0");
      const originalTimestamp = originalEntry?.timestamp;

      // Wait a bit to ensure timestamp would differ
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.update("github.com/user/repo@v1.0.0", "sha384-NEW", true);

      const updatedEntry = manager.get("github.com/user/repo@v1.0.0");
      expect(updatedEntry?.timestamp).toBe(originalTimestamp);
    });

    test("creates new entry if not exists", () => {
      const manager = new SumFileManager(testSumFile);
      manager.update("github.com/user/repo@v1.0.0", "sha384-NEW", true);

      const entry = manager.get("github.com/user/repo@v1.0.0");
      expect(entry).toBeDefined();
      expect(entry?.hash).toBe("sha384-NEW");
    });
  });

  describe("remove", () => {
    test("removes existing entry", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", true);

      const removed = manager.remove("github.com/user/repo@v1.0.0");

      expect(removed).toBe(true);
      expect(manager.get("github.com/user/repo@v1.0.0")).toBeUndefined();
    });

    test("returns false for non-existent entry", () => {
      const manager = new SumFileManager(testSumFile);
      const removed = manager.remove("github.com/user/repo@v1.0.0");

      expect(removed).toBe(false);
    });

    test("saves to file after removing", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", true);
      manager.add("github.com/user/tool@main", "sha384-XYZ789", true);

      manager.remove("github.com/user/repo@v1.0.0");

      const content = readFileSync(testSumFile, "utf-8");
      expect(content).not.toContain("github.com/user/repo@v1.0.0");
      expect(content).toContain("github.com/user/tool@main");
    });
  });

  describe("get", () => {
    test("retrieves existing entry", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC123", true);

      const entry = manager.get("github.com/user/repo@v1.0.0");

      expect(entry).toBeDefined();
      expect(entry?.hash).toBe("sha384-ABC123");
    });

    test("returns undefined for non-existent entry", () => {
      const manager = new SumFileManager(testSumFile);
      const entry = manager.get("github.com/user/nonexistent@v1.0.0");

      expect(entry).toBeUndefined();
    });
  });

  describe("getAll", () => {
    test("returns all entries", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo1@v1.0.0", "sha384-ABC", true);
      manager.add("github.com/user/repo2@v2.0.0", "sha384-DEF", false);
      manager.add("github.com/user/repo3@main", "sha384-GHI", true);

      const entries = manager.getAll();

      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.url)).toContain("github.com/user/repo1@v1.0.0");
      expect(entries.map((e) => e.url)).toContain("github.com/user/repo2@v2.0.0");
      expect(entries.map((e) => e.url)).toContain("github.com/user/repo3@main");
    });

    test("returns empty array when no entries", () => {
      const manager = new SumFileManager(testSumFile);
      expect(manager.getAll()).toEqual([]);
    });
  });

  describe("clear", () => {
    test("removes all entries", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo1@v1.0.0", "sha384-ABC", true);
      manager.add("github.com/user/repo2@v2.0.0", "sha384-DEF", false);

      manager.clear();

      expect(manager.getAll()).toEqual([]);
    });

    test("saves empty file after clearing", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC", true);

      manager.clear();

      expect(existsSync(testSumFile)).toBe(true);
      const content = readFileSync(testSumFile, "utf-8");
      expect(content).toContain("# kly.sum");
      expect(content).not.toContain("github.com/user/repo");
    });
  });

  describe("getStats", () => {
    test("returns correct statistics", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo1@v1.0.0", "sha384-ABC", true);
      manager.add("github.com/user/repo2@v2.0.0", "sha384-DEF", true);
      manager.add("github.com/user/repo3@main", "sha384-GHI", false);

      const stats = manager.getStats();

      expect(stats).toEqual({
        total: 3,
        trusted: 2,
        untrusted: 1,
      });
    });

    test("returns zero stats for empty manager", () => {
      const manager = new SumFileManager(testSumFile);
      const stats = manager.getStats();

      expect(stats).toEqual({
        total: 0,
        trusted: 0,
        untrusted: 0,
      });
    });
  });

  describe("file format", () => {
    test("saves with proper header", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/repo@v1.0.0", "sha384-ABC", true);

      const content = readFileSync(testSumFile, "utf-8");

      expect(content).toContain("# kly.sum - Integrity verification database");
      expect(content).toContain("# Format: url hash timestamp trusted|untrusted");
      expect(content).toContain("# DO NOT EDIT THIS FILE MANUALLY");
    });

    test("sorts entries by URL", () => {
      const manager = new SumFileManager(testSumFile);
      manager.add("github.com/user/zebra@v1.0.0", "sha384-Z", true);
      manager.add("github.com/user/alpha@v1.0.0", "sha384-A", true);
      manager.add("github.com/user/beta@v1.0.0", "sha384-B", true);

      const content = readFileSync(testSumFile, "utf-8");
      const lines = content.split("\n").filter((l) => !l.startsWith("#") && l.trim());

      expect(lines[0]).toContain("alpha");
      expect(lines[1]).toContain("beta");
      expect(lines[2]).toContain("zebra");
    });
  });
});
