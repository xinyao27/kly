import { execSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  branchToDbName,
  getChangedFiles,
  getCurrentBranch,
  getCurrentCommit,
  isAncestor,
  isGitRepo,
  getMergeBase,
} from "../git";
import { cleanupTempDir, createTempDir, writeFile } from "./helpers/fixtures";

function git(dir: string, cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: dir, encoding: "utf-8" }).trim();
}

function initGitRepo(dir: string): void {
  git(dir, "init");
  git(dir, 'config user.email "test@test.com"');
  git(dir, 'config user.name "Test"');
  writeFile(dir, "README.md", "# Test");
  git(dir, "add .");
  git(dir, 'commit -m "init"');
}

describe("git", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe("isGitRepo", () => {
    it("should return false for non-git directory", () => {
      expect(isGitRepo(tmpDir)).toBe(false);
    });

    it("should return true for git repository", () => {
      initGitRepo(tmpDir);
      expect(isGitRepo(tmpDir)).toBe(true);
    });
  });

  describe("getCurrentBranch", () => {
    it("should return branch name", () => {
      initGitRepo(tmpDir);
      // Default branch could be main or master
      const branch = getCurrentBranch(tmpDir);
      expect(branch).toBeTruthy();
    });

    it("should return null for detached HEAD", () => {
      initGitRepo(tmpDir);
      const commit = getCurrentCommit(tmpDir);
      git(tmpDir, `checkout ${commit} --quiet`);
      expect(getCurrentBranch(tmpDir)).toBeNull();
    });
  });

  describe("getCurrentCommit", () => {
    it("should return a 40-char hex string", () => {
      initGitRepo(tmpDir);
      const commit = getCurrentCommit(tmpDir);
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  describe("getChangedFiles", () => {
    it("should detect added files", () => {
      initGitRepo(tmpDir);
      const from = getCurrentCommit(tmpDir);
      writeFile(tmpDir, "new.ts", "export const x = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add new file"');

      const diff = getChangedFiles(tmpDir, from);
      expect(diff.added).toContain("new.ts");
    });

    it("should detect modified files", () => {
      initGitRepo(tmpDir);
      writeFile(tmpDir, "file.ts", "export const x = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add file"');
      const from = getCurrentCommit(tmpDir);

      writeFile(tmpDir, "file.ts", "export const x = 2;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "modify file"');

      const diff = getChangedFiles(tmpDir, from);
      expect(diff.modified).toContain("file.ts");
    });

    it("should detect deleted files", () => {
      initGitRepo(tmpDir);
      writeFile(tmpDir, "file.ts", "export const x = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add file"');
      const from = getCurrentCommit(tmpDir);

      git(tmpDir, "rm file.ts");
      git(tmpDir, 'commit -m "delete file"');

      const diff = getChangedFiles(tmpDir, from);
      expect(diff.deleted).toContain("file.ts");
    });

    it("should return empty diff when no changes", () => {
      initGitRepo(tmpDir);
      const commit = getCurrentCommit(tmpDir);
      const diff = getChangedFiles(tmpDir, commit);
      expect(diff.added).toEqual([]);
      expect(diff.modified).toEqual([]);
      expect(diff.deleted).toEqual([]);
      expect(diff.renamed).toEqual([]);
    });

    it("should detect renamed files", () => {
      initGitRepo(tmpDir);
      writeFile(tmpDir, "old.ts", "export const x = 1;");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "add old.ts"');
      const from = getCurrentCommit(tmpDir);

      git(tmpDir, "mv old.ts new.ts");
      git(tmpDir, 'commit -m "rename old.ts to new.ts"');

      const diff = getChangedFiles(tmpDir, from);
      expect(diff.renamed.length).toBe(1);
      expect(diff.renamed[0].from).toBe("old.ts");
      expect(diff.renamed[0].to).toBe("new.ts");
    });
  });

  describe("isAncestor", () => {
    it("should return true for ancestor commit", () => {
      initGitRepo(tmpDir);
      const first = getCurrentCommit(tmpDir);
      writeFile(tmpDir, "new.ts", "x");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "second"');
      const second = getCurrentCommit(tmpDir);

      expect(isAncestor(tmpDir, first, second)).toBe(true);
    });

    it("should return false for non-ancestor", () => {
      initGitRepo(tmpDir);
      writeFile(tmpDir, "new.ts", "x");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "second"');
      const second = getCurrentCommit(tmpDir);

      expect(isAncestor(tmpDir, second, "HEAD~1")).toBe(false);
    });
  });

  describe("getMergeBase", () => {
    it("should find merge base", () => {
      initGitRepo(tmpDir);
      const base = getCurrentCommit(tmpDir);
      writeFile(tmpDir, "new.ts", "x");
      git(tmpDir, "add .");
      git(tmpDir, 'commit -m "second"');

      const result = getMergeBase(tmpDir, base, "HEAD");
      expect(result).toBe(base);
    });

    it("should return null when merge base cannot be found", () => {
      // Non-git directory → exec will throw
      const result = getMergeBase(tmpDir, "abc", "def");
      expect(result).toBeNull();
    });
  });

  describe("branchToDbName", () => {
    it("should convert branch name with slashes", () => {
      expect(branchToDbName("feature/auth")).toBe("feature--auth");
    });

    it("should handle null (detached HEAD)", () => {
      expect(branchToDbName(null, "abcdef1234567890")).toBe("_detached--abcdef12");
    });

    it("should handle simple branch name", () => {
      expect(branchToDbName("main")).toBe("main");
    });

    it("should use 'unknown' when detached without commit hash", () => {
      expect(branchToDbName(null)).toBe("_detached--unknown");
    });
  });
});
