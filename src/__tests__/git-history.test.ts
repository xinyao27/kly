import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getFileHistory } from "../git";
import { cleanupTempDir, createTempDir } from "./helpers/fixtures";

describe("getFileHistory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    // Initialize a git repo with commits
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    execSync("git config user.email test@test.com", { cwd: tmpDir, stdio: "pipe" });
    execSync("git config user.name TestUser", { cwd: tmpDir, stdio: "pipe" });

    const filePath = path.join(tmpDir, "test.ts");
    fs.writeFileSync(filePath, "// v1\n");
    execSync("git add . && git commit -m 'initial commit'", { cwd: tmpDir, stdio: "pipe" });

    fs.writeFileSync(filePath, "// v2\n");
    execSync("git add . && git commit -m 'second commit'", { cwd: tmpDir, stdio: "pipe" });

    fs.writeFileSync(filePath, "// v3\n");
    execSync("git add . && git commit -m 'third commit'", { cwd: tmpDir, stdio: "pipe" });
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("returns recent commits for a file", () => {
    const history = getFileHistory(tmpDir, "test.ts", 5);

    expect(history).toHaveLength(3);
    expect(history[0].message).toBe("third commit");
    expect(history[1].message).toBe("second commit");
    expect(history[2].message).toBe("initial commit");
    expect(history[0].author).toBe("TestUser");
    expect(history[0].email).toBe("test@test.com");
    expect(history[0].hash).toHaveLength(40);
    expect(typeof history[0].date).toBe("number");
  });

  it("respects limit", () => {
    const history = getFileHistory(tmpDir, "test.ts", 2);
    expect(history).toHaveLength(2);
    expect(history[0].message).toBe("third commit");
  });

  it("returns empty array for nonexistent file", () => {
    const history = getFileHistory(tmpDir, "nonexistent.ts");
    expect(history).toEqual([]);
  });

  it("returns empty array for non-git directory", () => {
    const nonGitDir = createTempDir();
    try {
      const history = getFileHistory(nonGitDir, "test.ts");
      expect(history).toEqual([]);
    } finally {
      cleanupTempDir(nonGitDir);
    }
  });
});
