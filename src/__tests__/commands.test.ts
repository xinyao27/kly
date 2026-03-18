import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initKlyDir } from "../config";
import { ensureInitialized } from "../commands/shared";
import { runShow } from "../commands/show";
import { runOverview } from "../commands/overview";
import { runGc } from "../commands/gc";
import { runGraph } from "../commands/graph";
import { openDatabase } from "../store";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures";

// Mock @clack/prompts to capture output
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
}));

// Capture process.exit
vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit(${code})`);
});

import * as p from "@clack/prompts";

describe("ensureInitialized", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("exits with code 1 when not initialized", () => {
    expect(() => ensureInitialized(tmpDir)).toThrow("process.exit(1)");
    expect(p.log.error).toHaveBeenCalledWith("Not initialized. Run `kly init` first.");
  });

  it("does nothing when initialized", () => {
    initKlyDir(tmpDir);
    expect(() => ensureInitialized(tmpDir)).not.toThrow();
  });
});

describe("runShow", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", () => {
    expect(() => runShow(tmpDir, "any.ts")).toThrow("process.exit(1)");
  });

  it("warns when file not in index", () => {
    initKlyDir(tmpDir);
    runShow(tmpDir, "nonexistent.ts");
    expect(p.log.warn).toHaveBeenCalledWith("File not found in index: nonexistent.ts");
  });

  it("displays file details when found", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    const fileIndex = createFileIndex({ path: "src/test.ts" });
    db.upsertFile(fileIndex);
    db.close();

    runShow(tmpDir, "src/test.ts");
    expect(p.note).toHaveBeenCalled();
  });
});

describe("runOverview", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", () => {
    expect(() => runOverview(tmpDir)).toThrow("process.exit(1)");
  });

  it("warns when no files indexed", () => {
    initKlyDir(tmpDir);
    runOverview(tmpDir);
    expect(p.log.warn).toHaveBeenCalledWith("No files indexed yet. Run `kly build` first.");
  });

  it("displays overview when files exist", () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(createFileIndex());
    db.close();

    runOverview(tmpDir);
    expect(p.note).toHaveBeenCalled();
  });
});

describe("runGc", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", () => {
    expect(() => runGc(tmpDir)).toThrow("process.exit(1)");
  });

  it("warns when not a git repo", () => {
    initKlyDir(tmpDir);
    runGc(tmpDir);
    expect(p.log.warn).toHaveBeenCalledWith("Not a git repository. Nothing to clean.");
  });
});

describe("runGraph", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("exits when not initialized", async () => {
    await expect(runGraph(tmpDir, { format: "mermaid" })).rejects.toThrow("process.exit(1)");
  });

  it("warns when no files indexed", async () => {
    initKlyDir(tmpDir);
    await runGraph(tmpDir, { format: "mermaid" });
    expect(p.log.warn).toHaveBeenCalledWith("No files indexed yet. Run `kly build` first.");
  });

  it("warns when no dependencies found", async () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(createFileIndex({ imports: [] }));
    db.close();

    await runGraph(tmpDir, { format: "mermaid" });
    expect(p.log.warn).toHaveBeenCalledWith("No dependencies found between indexed files.");
  });
});
