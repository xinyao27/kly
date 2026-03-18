import { execSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock pi-ai
vi.mock("@mariozechner/pi-ai", () => ({
  complete: vi.fn(),
  getModel: vi.fn(() => ({})),
}));

import { complete } from "@mariozechner/pi-ai";

import { initKlyDir } from "../config.js";
import { buildIndex } from "../indexer.js";
import { copyDatabase, loadState, openDatabase, resolveDbName, saveState } from "../store.js";
import { cleanupTempDir, createTempDir, writeFile } from "./helpers/fixtures.js";

function git(dir: string, cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: dir, encoding: "utf-8" }).trim();
}

function initGitRepo(dir: string): void {
  git(dir, "init -b main");
  git(dir, 'config user.email "test@test.com"');
  git(dir, 'config user.name "Test"');
}

function mockLLMResponse(name: string, description: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          name,
          description,
          summary: `Summary of ${name}`,
          symbols: [],
        }),
      },
    ],
  };
}

describe("git-aware integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe("resolveDbName", () => {
    it("should return 'default' for non-git dirs", () => {
      expect(resolveDbName(tmpDir)).toBe("default");
    });

    it("should return branch name for git repos", () => {
      initGitRepo(tmpDir);
      writeFile(tmpDir, "README.md", "# test");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "init"');
      expect(resolveDbName(tmpDir)).toBe("main");
    });

    it("should return detached name for detached HEAD", () => {
      initGitRepo(tmpDir);
      writeFile(tmpDir, "README.md", "# test");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "init"');
      const commit = git(tmpDir, "rev-parse HEAD");
      git(tmpDir, `checkout ${commit} --quiet`);
      const name = resolveDbName(tmpDir);
      expect(name).toMatch(/^_detached--[0-9a-f]{8}$/);
    });
  });

  describe("copyDatabase", () => {
    it("should copy a database file", () => {
      initKlyDir(tmpDir);
      const db = openDatabase(tmpDir, "source");
      db.setMetadata("test", "value");
      db.close();

      copyDatabase(tmpDir, "source", "dest");

      const destDb = openDatabase(tmpDir, "dest");
      expect(destDb.getMetadata("test")).toBe("value");
      destDb.close();
    });

    it("should be a no-op when source does not exist", () => {
      initKlyDir(tmpDir);
      // Should not throw
      copyDatabase(tmpDir, "nonexistent", "dest");
    });
  });

  describe("git-aware build", () => {
    it("should use git-incremental mode in a git repo", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      // Initial commit with one file
      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      let callCount = 0;
      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return mockLLMResponse(`Module ${callCount}`, "desc");
      });

      // First build
      await buildIndex(tmpDir);
      expect(callCount).toBe(1);

      const db1 = openDatabase(tmpDir, "main");
      expect(db1.getFileCount()).toBe(1);
      db1.close();

      // Verify state was saved
      const state = loadState(tmpDir);
      expect(state.branches.main).toBeDefined();
      expect(state.branches.main.lastCommit).toBeTruthy();

      // Add a new file and commit
      writeFile(tmpDir, "src/b.ts", "export const b = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add b.ts"');

      // Second build — should only index b.ts via git diff
      await buildIndex(tmpDir);
      expect(callCount).toBe(2); // Only one new LLM call for b.ts

      const db2 = openDatabase(tmpDir, "main");
      expect(db2.getFileCount()).toBe(2);
      expect(db2.getFile("src/a.ts")).toBeDefined();
      expect(db2.getFile("src/b.ts")).toBeDefined();
      db2.close();
    });

    it("should handle deleted files in git diff", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      writeFile(tmpDir, "src/b.ts", "export const b = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add files"');

      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
        mockLLMResponse("Module", "desc"),
      );

      await buildIndex(tmpDir);

      // Delete b.ts and commit
      git(tmpDir, "rm src/b.ts");
      git(tmpDir, 'commit -m "delete b.ts"');

      await buildIndex(tmpDir);

      const db = openDatabase(tmpDir, "main");
      expect(db.getFileCount()).toBe(1);
      expect(db.getFile("src/b.ts")).toBeUndefined();
      db.close();
    });

    it("should create separate db for different branches", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
        mockLLMResponse("Module", "desc"),
      );

      await buildIndex(tmpDir);

      // Create and switch to feature branch
      git(tmpDir, "checkout -b feature--test");
      writeFile(tmpDir, "src/b.ts", "export const b = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add b.ts on feature"');

      await buildIndex(tmpDir);

      // feature branch should have its own db
      const featureDb = openDatabase(tmpDir, "feature--test");
      expect(featureDb.getFileCount()).toBeGreaterThanOrEqual(1);
      featureDb.close();
    });

    it("should force full rebuild with --full flag", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      let callCount = 0;
      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return mockLLMResponse(`Module v${callCount}`, "desc");
      });

      await buildIndex(tmpDir);
      expect(callCount).toBe(1);

      // Full rebuild
      await buildIndex(tmpDir, { full: true });
      expect(callCount).toBe(2);
    });

    it("should handle renamed files in git diff mode", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/old.ts", "export const x = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add old.ts"');

      let callCount = 0;
      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return mockLLMResponse(`Module v${callCount}`, "desc");
      });

      await buildIndex(tmpDir);
      expect(callCount).toBe(1);

      // Rename file and commit
      git(tmpDir, "mv src/old.ts src/new.ts");
      git(tmpDir, 'commit -m "rename old to new"');

      await buildIndex(tmpDir);
      // Should have re-indexed the renamed file
      expect(callCount).toBe(2);

      const db = openDatabase(tmpDir, "main");
      expect(db.getFile("src/old.ts")).toBeUndefined();
      expect(db.getFile("src/new.ts")).toBeDefined();
      db.close();
    });

    it("should fall back to hash-based when rebase is detected", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      let callCount = 0;
      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return mockLLMResponse(`Module v${callCount}`, "desc");
      });

      await buildIndex(tmpDir);
      expect(callCount).toBe(1);

      // Simulate rebase by amending the commit (changes the commit hash)
      writeFile(tmpDir, "src/a.ts", "export const a = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit --amend -m "amended commit"');

      // The state still has the old commit hash, which is no longer an ancestor
      await buildIndex(tmpDir);
      // Should have re-indexed via fallback
      expect(callCount).toBe(2);
    });

    it("should handle new branch with no parent fork available", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
        mockLLMResponse("Module", "desc"),
      );

      // Don't build on main first — so no parent db exists
      // Switch to feature branch
      git(tmpDir, "checkout -b feature/new-feature");
      writeFile(tmpDir, "src/b.ts", "export const b = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add b.ts"');

      // Build on feature branch — no main.db to fork from
      await buildIndex(tmpDir);

      const db = openDatabase(tmpDir, "feature--new-feature");
      expect(db.getFileCount()).toBeGreaterThanOrEqual(1);
      db.close();
    });

    it("should fall back when forked from parent with no state entry", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
        mockLLMResponse("Module", "desc"),
      );

      // Build on main so main.db exists
      await buildIndex(tmpDir);

      // Remove main's state entry but keep the db file
      const state = loadState(tmpDir);
      delete state.branches.main;
      saveState(tmpDir, state);

      // Switch to new branch
      git(tmpDir, "checkout -b feature/no-parent-state");
      writeFile(tmpDir, "src/b.ts", "export const b = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add b.ts"');

      // Build on feature — forks main.db but parentState is undefined → mergeBase is null → classic fallback
      await buildIndex(tmpDir);

      const db = openDatabase(tmpDir, "feature--no-parent-state");
      expect(db.getFileCount()).toBeGreaterThanOrEqual(1);
      db.close();
    });

    it("should fall back to full build when forked but no merge base found", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
        mockLLMResponse("Module", "desc"),
      );

      // Build on main first so main.db exists
      await buildIndex(tmpDir);

      // Tamper with state: set main's lastCommit to a non-existent hash
      // so getMergeBase will fail
      const state = loadState(tmpDir);
      state.branches.main.lastCommit = "0000000000000000000000000000000000000000";
      saveState(tmpDir, state);

      // Switch to new branch
      git(tmpDir, "checkout -b feature/edge-case");
      writeFile(tmpDir, "src/b.ts", "export const b = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add b.ts"');

      // Build on feature branch — fork from main succeeds, but mergeBase fails
      // because the fake commit doesn't exist
      await buildIndex(tmpDir);

      const db = openDatabase(tmpDir, "feature--edge-case");
      // Should have built via classic fallback
      expect(db.getFileCount()).toBeGreaterThanOrEqual(1);
      db.close();
    });

    it("should handle config hash change (force full rebuild)", async () => {
      initGitRepo(tmpDir);
      initKlyDir(tmpDir);

      writeFile(tmpDir, "src/a.ts", "export const a = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add a.ts"');

      let callCount = 0;
      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return mockLLMResponse(`Module v${callCount}`, "desc");
      });

      await buildIndex(tmpDir);
      expect(callCount).toBe(1);

      // Change include config
      initKlyDir(tmpDir, {
        llm: { provider: "openrouter", model: "test", apiKey: "test" },
        include: ["**/*.ts", "**/*.js"],
        exclude: [],
      });

      // New commit to have something to diff against
      writeFile(tmpDir, "src/b.ts", "export const b = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add b.ts"');

      await buildIndex(tmpDir);
      // Should have re-indexed everything due to config change
      expect(callCount).toBeGreaterThan(1);
    });
  });
});
