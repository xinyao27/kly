import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture process.exit
vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit(${code})`);
});

let stderrData: string;

import { runHook } from "../commands/hook";
import { cleanupTempDir, createTempDir } from "./helpers/fixtures";

function createGitHooksDir(root: string): string {
  const hooksDir = path.join(root, ".git", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  return hooksDir;
}

describe("runHook", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    stderrData = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: any) => {
      stderrData += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    // eslint-disable-next-line typescript-eslint/unbound-method
    (vi.mocked(process.stderr.write).mockRestore as (() => void) | undefined)?.();
    cleanupTempDir(tmpDir);
  });

  it("installs the post-commit hook once", () => {
    createGitHooksDir(tmpDir);

    runHook(tmpDir, "install");
    runHook(tmpDir, "install");

    const hookPath = path.join(tmpDir, ".git", "hooks", "post-commit");
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content.match(/# BEGIN kly/g)).toHaveLength(1);
    expect(stderrData).toContain("already installed");
  });

  it("removes only the managed block during uninstall", () => {
    const hooksDir = createGitHooksDir(tmpDir);
    const hookPath = path.join(hooksDir, "post-commit");
    fs.writeFileSync(
      hookPath,
      "#!/bin/sh\necho before\n# BEGIN kly\nkly build --quiet 2>/dev/null || true\n# END kly\necho after\n",
      "utf-8",
    );

    runHook(tmpDir, "uninstall");

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("echo before");
    expect(content).toContain("echo after");
    expect(content).not.toContain("# BEGIN kly");
    expect(stderrData).toContain("uninstalled");
  });

  it("warns when uninstalling a hook that is not managed by kly", () => {
    const hooksDir = createGitHooksDir(tmpDir);
    const hookPath = path.join(hooksDir, "post-commit");
    fs.writeFileSync(hookPath, "#!/bin/sh\necho custom\n", "utf-8");

    runHook(tmpDir, "uninstall");

    expect(stderrData).toContain("kly hook not found");
  });
});
