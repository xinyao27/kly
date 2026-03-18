import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock pi-ai before importing indexer
vi.mock("@mariozechner/pi-ai", () => ({
  complete: vi.fn(),
  getModel: vi.fn(() => ({})),
}));

import { complete } from "@mariozechner/pi-ai";

import { initKlyDir } from "../config.js";
import { buildIndex } from "../indexer.js";
import { openDatabase } from "../store.js";
import { cleanupTempDir, createTempDir, writeFile } from "./helpers/fixtures.js";

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

describe("indexer", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("should build index for a project", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/hello.ts", 'export function hello() { return "world"; }');

    let callCount = 0;
    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return mockLLMResponse("Hello Module", "A greeting module");
    });

    await buildIndex(tmpDir);

    // Verify index was created in SQLite
    const db = openDatabase(tmpDir, "default");
    try {
      const files = db.getAllFiles();
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("src/hello.ts");
      expect(files[0].name).toBe("Hello Module");
      expect(files[0].language).toBe("typescript");
      expect(files[0].imports).toEqual([]);
      expect(files[0].exports).toContain("hello");
      expect(callCount).toBe(1);
    } finally {
      db.close();
    }
  });

  it("should skip unchanged files (hash-based incremental)", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/a.ts", "export const a = 1;");

    let callCount = 0;
    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return mockLLMResponse("Module A", "desc");
    });

    // First build
    await buildIndex(tmpDir);
    expect(callCount).toBe(1);

    // Second build - no changes, hash-based skip
    await buildIndex(tmpDir);
    expect(callCount).toBe(1); // No additional LLM calls
  });

  it("should re-index modified files", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/a.ts", "export const a = 1;");

    let callCount = 0;
    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return mockLLMResponse(`Module v${callCount}`, "desc");
    });

    // First build
    await buildIndex(tmpDir);
    expect(callCount).toBe(1);

    // Modify file
    writeFile(tmpDir, "src/a.ts", "export const a = 2; export const b = 3;");

    // Second build - file changed
    await buildIndex(tmpDir);
    expect(callCount).toBe(2);

    const db = openDatabase(tmpDir, "default");
    try {
      expect(db.getFile("src/a.ts")!.name).toBe("Module v2");
    } finally {
      db.close();
    }
  });

  it("should remove deleted files from store", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/a.ts", "export const a = 1;");
    writeFile(tmpDir, "src/b.ts", "export const b = 2;");

    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      mockLLMResponse("Module", "desc"),
    );

    await buildIndex(tmpDir);
    const db1 = openDatabase(tmpDir, "default");
    expect(db1.getFileCount()).toBe(2);
    db1.close();

    // Delete one file
    const fs = await import("node:fs");
    fs.unlinkSync(`${tmpDir}/src/b.ts`);

    await buildIndex(tmpDir);
    const db2 = openDatabase(tmpDir, "default");
    try {
      expect(db2.getFileCount()).toBe(1);
      expect(db2.getFile("src/a.ts")).toBeDefined();
      expect(db2.getFile("src/b.ts")).toBeUndefined();
    } finally {
      db2.close();
    }
  });

  it("should merge LLM symbol descriptions with parsed symbols", async () => {
    initKlyDir(tmpDir);
    writeFile(
      tmpDir,
      "src/svc.ts",
      "export class UserService {\n  getUser() { return null; }\n}\nexport function helper() {}",
    );

    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            name: "User Service",
            description: "Manages users",
            summary: "A service for user management",
            symbols: [
              { name: "UserService", description: "The main service class" },
              { name: "getUser", description: "Fetches a user" },
            ],
          }),
        },
      ],
    }));

    await buildIndex(tmpDir);
    const db = openDatabase(tmpDir, "default");
    try {
      const file = db.getFile("src/svc.ts")!;
      const userServiceSymbol = file.symbols.find((s: { name: string }) => s.name === "UserService");
      expect(userServiceSymbol?.description).toBe("The main service class");
      const helperSymbol = file.symbols.find((s: { name: string }) => s.name === "helper");
      expect(helperSymbol?.description).toBe("");
    } finally {
      db.close();
    }
  });

  it("should use file basename when LLM returns empty name", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/util.ts", "export const x = 1;");

    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            name: "",
            description: "",
            summary: "",
            symbols: [],
          }),
        },
      ],
    }));

    await buildIndex(tmpDir);
    const db = openDatabase(tmpDir, "default");
    try {
      expect(db.getFile("src/util.ts")!.name).toBe("util.ts");
    } finally {
      db.close();
    }
  });

  it("should handle files with unknown language (fallback to typescript)", async () => {
    initKlyDir(tmpDir, {
      llm: { provider: "openrouter", model: "test", apiKey: "test" },
      include: ["**/*.ts", "**/*.xyz"],
      exclude: [],
    });
    writeFile(tmpDir, "src/data.xyz", "some content");

    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      mockLLMResponse("Data File", "An XYZ data file"),
    );

    await buildIndex(tmpDir);
    const db = openDatabase(tmpDir, "default");
    try {
      const file = db.getFile("src/data.xyz");
      expect(file).toBeDefined();
      expect(file!.language).toBe("typescript");
      expect(file!.imports).toEqual([]);
      expect(file!.exports).toEqual([]);
      expect(file!.symbols).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("should trigger onProgress callback", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/a.ts", "export const a = 1;");
    writeFile(tmpDir, "src/b.ts", "export const b = 2;");

    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      mockLLMResponse("Module", "desc"),
    );

    const progressCalls: { total: number; completed: number }[] = [];
    await buildIndex(tmpDir, {
      onProgress: (p) => progressCalls.push({ total: p.total, completed: p.completed }),
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    const last = progressCalls[progressCalls.length - 1];
    expect(last.completed).toBe(last.total);
  });

  it("should force full rebuild with full option", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/a.ts", "export const a = 1;");

    let callCount = 0;
    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return mockLLMResponse(`Module v${callCount}`, "desc");
    });

    await buildIndex(tmpDir);
    expect(callCount).toBe(1);

    // Force full rebuild even though nothing changed
    await buildIndex(tmpDir, { full: true });
    expect(callCount).toBe(2);
  });
});
