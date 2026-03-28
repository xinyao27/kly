import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sharedMocks = vi.hoisted(() => {
  const cancelled = Symbol("cancelled");

  return {
    cancelled,
    select: vi.fn(),
    password: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    isCancel: vi.fn((value: unknown) => value === cancelled),
    runHook: vi.fn(),
    buildIndex: vi.fn(),
  };
});

vi.mock("../commands/hook", () => ({
  runHook: sharedMocks.runHook,
}));

vi.mock("../indexer", () => ({
  buildIndex: sharedMocks.buildIndex,
}));

// Mock @clack/prompts for init interactive mode
vi.mock("@clack/prompts", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
  note: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
  select: sharedMocks.select,
  password: sharedMocks.password,
  text: sharedMocks.text,
  confirm: sharedMocks.confirm,
  intro: sharedMocks.intro,
  outro: sharedMocks.outro,
  cancel: sharedMocks.cancel,
  isCancel: sharedMocks.isCancel,
}));

// Capture stdout/stderr
let stdoutData: string;
let stderrData: string;
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

// Capture process.exit
vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit(${code})`);
});

import { initKlyDir, isInitialized, loadConfig } from "../config";
import { runBuild } from "../commands/build";
import { runInit } from "../commands/init";
import { runQuery } from "../commands/query";
import { runShow } from "../commands/show";
import { runOverview } from "../commands/overview";
import { runGc } from "../commands/gc";
import { runGraph } from "../commands/graph";
import { runDependents } from "../commands/dependents";
import { runHistory } from "../commands/history";
import { ensureInitialized } from "../commands/shared";
import { openDatabase } from "../store";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures";

function captureOutput() {
  stdoutData = "";
  stderrData = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
    stdoutData += typeof chunk === "string" ? chunk : chunk.toString();
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: any) => {
    stderrData += typeof chunk === "string" ? chunk : chunk.toString();
    return true;
  });
}

function restoreOutput() {
  vi.mocked(process.stdout.write).mockRestore?.();
  vi.mocked(process.stderr.write).mockRestore?.();
}

describe("ensureInitialized", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("exits with code 1 when not initialized", () => {
    expect(() => ensureInitialized(tmpDir)).toThrow("process.exit(1)");
    expect(stderrData).toContain("Not initialized");
  });

  it("does nothing when initialized", () => {
    initKlyDir(tmpDir);
    expect(() => ensureInitialized(tmpDir)).not.toThrow();
  });
});

describe("runInit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("non-interactive: creates config from flags", async () => {
    await runInit(tmpDir, {
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "sk-test",
    });

    expect(isInitialized(tmpDir)).toBe(true);
    expect(loadConfig(tmpDir)).toMatchObject({
      llm: { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" },
    });
  });

  it("non-interactive: uses default model when not specified", async () => {
    await runInit(tmpDir, {
      provider: "openrouter",
      apiKey: "sk-or-test",
    });

    expect(loadConfig(tmpDir)).toMatchObject({
      llm: { provider: "openrouter", model: "anthropic/claude-haiku-4.5" },
    });
  });

  it("non-interactive: rejects invalid provider", async () => {
    await expect(
      runInit(tmpDir, { provider: "invalid", apiKey: "key" }),
    ).rejects.toThrow("process.exit(1)");
    expect(stderrData).toContain("Invalid provider");
  });

  it("interactive: falls back when no flags given", async () => {
    sharedMocks.select.mockResolvedValue("openai");
    sharedMocks.password.mockResolvedValue("sk-test");
    sharedMocks.text.mockResolvedValue("gpt-4o-mini");
    sharedMocks.confirm.mockResolvedValue(false);

    await runInit(tmpDir);
    expect(isInitialized(tmpDir)).toBe(true);
  });

  it("interactive: exits when cancelled", async () => {
    sharedMocks.select.mockResolvedValue(sharedMocks.cancelled);
    await expect(runInit(tmpDir)).rejects.toThrow("process.exit(0)");
  });
});

describe("runBuild", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    initKlyDir(tmpDir);
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("passes options through to the indexer", async () => {
    sharedMocks.buildIndex.mockResolvedValue({
      totalFiles: 2,
      newFiles: 1,
      updatedFiles: 1,
      deletedFiles: 0,
      unchangedFiles: 0,
      branch: "main",
      commit: "abc1234567",
      durationMs: 1500,
    });

    await runBuild(tmpDir, { full: true });

    expect(sharedMocks.buildIndex).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({
        full: true,
        onProgress: expect.any(Function),
      }),
    );
    expect(stdoutData).toContain("indexed 2 files");
    expect(stdoutData).toContain("1 new");
    expect(stdoutData).toContain("branch: main");
  });

  it("suppresses output in quiet mode", async () => {
    sharedMocks.buildIndex.mockResolvedValue({
      totalFiles: 0,
      newFiles: 0,
      updatedFiles: 0,
      deletedFiles: 0,
      unchangedFiles: 0,
      branch: "main",
      commit: "abc1234",
      durationMs: 100,
    });

    await runBuild(tmpDir, { quiet: true });
    expect(stdoutData).toBe("");
  });

  it("logs error and exits when indexer throws", async () => {
    sharedMocks.buildIndex.mockRejectedValue(new Error("LLM unavailable"));

    await expect(runBuild(tmpDir)).rejects.toThrow("process.exit(1)");
    expect(stderrData).toContain("LLM unavailable");
  });
});

describe("runShow", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", () => {
    expect(() => runShow(tmpDir, "any.ts")).toThrow("process.exit(1)");
  });

  it("errors when file not in index", () => {
    initKlyDir(tmpDir);
    expect(() => runShow(tmpDir, "nonexistent.ts")).toThrow("process.exit(1)");
    expect(stderrData).toContain("File not found in index");
  });

  it("outputs JSON by default", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(
      createFileIndex({
        path: "src/test.ts",
        imports: ["fs", "path"],
        exports: ["runTest"],
      }),
    );
    db.close();

    runShow(tmpDir, "src/test.ts");
    const parsed = JSON.parse(stdoutData);
    expect(parsed.path).toBe("src/test.ts");
    expect(parsed.imports).toEqual(["fs", "path"]);
  });

  it("outputs pretty format", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(createFileIndex({ path: "src/test.ts" }));
    db.close();

    runShow(tmpDir, "src/test.ts", { pretty: true });
    expect(stdoutData).toContain("path: src/test.ts");
    expect(stdoutData).toContain("language: typescript");
  });
});

describe("runOverview", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", () => {
    expect(() => runOverview(tmpDir)).toThrow("process.exit(1)");
  });

  it("outputs JSON with file counts", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFiles([
      createFileIndex({ path: "src/a.ts" }),
      createFileIndex({ path: "src/b.ts" }),
    ]);
    db.close();

    runOverview(tmpDir);
    const parsed = JSON.parse(stdoutData);
    expect(parsed.totalFiles).toBe(2);
    expect(parsed.languages.typescript).toBe(2);
  });
});

describe("runQuery", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("returns empty array when no match", async () => {
    initKlyDir(tmpDir);
    await runQuery(tmpDir, "missing");
    const parsed = JSON.parse(stdoutData);
    expect(parsed).toEqual([]);
  });

  it("returns matching files as JSON", async () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(
      createFileIndex({
        path: "src/auth.ts",
        description: "Authentication service",
      }),
    );
    db.close();

    await runQuery(tmpDir, "Authentication");
    const parsed = JSON.parse(stdoutData);
    expect(parsed.length).toBe(1);
    expect(parsed[0].path).toBe("src/auth.ts");
    expect(parsed[0].score).toBeGreaterThan(0);
  });
});

describe("runGraph", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", () => {
    expect(() => runGraph(tmpDir)).toThrow("process.exit(1)");
  });

  it("outputs JSON graph", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFiles([
      createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
      createFileIndex({ path: "src/b.ts" }),
    ]);
    db.close();

    runGraph(tmpDir);
    const parsed = JSON.parse(stdoutData);
    expect(parsed.nodes.length).toBe(2);
    expect(parsed.edges.length).toBe(1);
    expect(parsed.edges[0]).toEqual({ from: "src/a.ts", to: "src/b.ts" });
  });

  it("outputs pretty format", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFiles([
      createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
      createFileIndex({ path: "src/b.ts" }),
    ]);
    db.close();

    runGraph(tmpDir, { pretty: true });
    expect(stdoutData).toContain("src/a.ts");
    expect(stdoutData).toContain("-> src/b.ts");
  });
});

describe("runDependents", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("exits when file not in index", () => {
    initKlyDir(tmpDir);
    expect(() => runDependents(tmpDir, "nonexistent.ts")).toThrow("process.exit(1)");
  });

  it("returns dependents from dependencies table", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFiles([
      createFileIndex({ path: "src/types.ts" }),
      createFileIndex({ path: "src/database.ts", imports: ["./types"] }),
    ]);
    db.upsertDependencies("src/database.ts", ["src/types.ts"]);
    db.close();

    runDependents(tmpDir, "src/types.ts");
    const parsed = JSON.parse(stdoutData);
    expect(parsed.file).toBe("src/types.ts");
    expect(parsed.dependents).toEqual(["src/database.ts"]);
  });
});

describe("runGc", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", () => {
    expect(() => runGc(tmpDir)).toThrow("process.exit(1)");
  });

  it("warns when not a git repo", () => {
    initKlyDir(tmpDir);
    runGc(tmpDir);
    expect(stderrData).toContain("not a git repository");
  });
});
