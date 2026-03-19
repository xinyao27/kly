import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initKlyDir } from "../config";
import { runQuery } from "../commands/query";
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
    const fileIndex = createFileIndex({
      path: "src/test.ts",
      imports: ["fs", "path"],
      exports: ["runTest"],
      symbols: [{ name: "runTest", kind: "function", description: "Runs the test workflow." }],
    });
    db.upsertFile(fileIndex);
    db.close();

    runShow(tmpDir, "src/test.ts");
    expect(p.note).toHaveBeenCalledWith(
      expect.stringContaining("Imports (2):"),
      "Indexed File: src/test.ts",
    );
    expect(p.note).toHaveBeenCalledWith(
      expect.stringContaining("Symbols (1):"),
      "Indexed File: src/test.ts",
    );
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
    db.upsertFiles([
      createFileIndex({ path: "src/a.ts", description: "A" }),
      createFileIndex({ path: "src/b.ts", description: "B" }),
      createFileIndex({ path: "src/c.ts", description: "C" }),
      createFileIndex({ path: "src/d.ts", description: "D" }),
      createFileIndex({ path: "src/e.ts", description: "E" }),
      createFileIndex({ path: "src/f.ts", description: "F" }),
    ]);
    db.close();

    runOverview(tmpDir);
    expect(p.note).toHaveBeenCalledWith(
      expect.stringContaining("Indexed languages: 1"),
      "Repository Overview",
    );
    expect(p.note).toHaveBeenCalledWith(
      expect.stringContaining("... 1 more file(s)"),
      "Repository Overview",
    );
  });
});

describe("runQuery", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("warns when no files match", async () => {
    initKlyDir(tmpDir);
    await runQuery(tmpDir, "missing");
    expect(p.log.warn).toHaveBeenCalledWith("No matching files found.");
  });

  it("renders formatted query results", async () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(
      createFileIndex({
        path: "src/auth.ts",
        description: "Authentication entrypoints",
        summary:
          "Handles login, logout, token refresh, and session validation for the application.",
        symbols: [
          { name: "login", kind: "function", description: "Signs a user in." },
          { name: "logout", kind: "function", description: "Signs a user out." },
          { name: "refreshSession", kind: "function", description: "Refreshes a session." },
          { name: "requireAuth", kind: "function", description: "Enforces auth." },
          { name: "AuthError", kind: "class", description: "Authentication error." },
          { name: "readCookie", kind: "function", description: "Reads the auth cookie." },
        ],
      }),
    );
    db.close();

    await runQuery(tmpDir, "Authentication");

    expect(p.log.info).toHaveBeenCalledWith("Found 1 matching file(s).");
    expect(p.log.message).toHaveBeenCalledWith(expect.stringContaining("1. src/auth.ts"));
    expect(p.log.message).toHaveBeenCalledWith(expect.stringContaining("Score:"));
    expect(p.log.message).toHaveBeenCalledWith(
      expect.stringContaining("Symbols: login, logout, refreshSession, requireAuth, AuthError (+1 more)"),
    );
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

  it("rejects invalid depth values", async () => {
    initKlyDir(tmpDir);
    await expect(runGraph(tmpDir, { format: "mermaid", depth: 0 })).rejects.toThrow("process.exit(1)");
    expect(p.log.error).toHaveBeenCalledWith("`--depth` must be a positive integer.");
  });

  it("warns when the focused file is not indexed", async () => {
    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.upsertFile(createFileIndex({ path: "src/a.ts" }));
    db.close();

    await runGraph(tmpDir, { format: "mermaid", focus: "src/missing.ts" });
    expect(p.log.warn).toHaveBeenCalledWith("Focused file is not indexed: src/missing.ts");
  });
});
