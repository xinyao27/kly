import fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock pi-ai before importing indexer
vi.mock("@mariozechner/pi-ai", () => ({
  complete: vi.fn(),
  getModel: vi.fn(() => ({})),
}));

import { complete } from "@mariozechner/pi-ai";

import { getIndexPath, initKlyDir } from "../config.js";
import { buildIndex } from "../indexer.js";
import { loadStore } from "../store.js";
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
    // Setup project
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/hello.ts", 'export function hello() { return "world"; }');

    let callCount = 0;
    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return mockLLMResponse("Hello Module", "A greeting module");
    });

    await buildIndex(tmpDir);

    // Verify index was created
    expect(fs.existsSync(getIndexPath(tmpDir))).toBe(true);

    const store = loadStore(tmpDir);
    expect(store.files).toHaveLength(1);
    expect(store.files[0].path).toBe("src/hello.ts");
    expect(store.files[0].name).toBe("Hello Module");
    expect(store.files[0].language).toBe("typescript");
    expect(store.files[0].imports).toEqual([]);
    expect(store.files[0].exports).toContain("hello");
    expect(callCount).toBe(1);
  });

  it("should skip unchanged files in incremental mode", async () => {
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

    // Second build (incremental) - no changes
    await buildIndex(tmpDir, { incremental: true });
    expect(callCount).toBe(1); // No additional LLM calls
  });

  it("should re-index modified files in incremental mode", async () => {
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

    // Second build (incremental) - file changed
    await buildIndex(tmpDir, { incremental: true });
    expect(callCount).toBe(2);

    const store = loadStore(tmpDir);
    expect(store.files[0].name).toBe("Module v2");
  });

  it("should remove deleted files from store", async () => {
    initKlyDir(tmpDir);
    writeFile(tmpDir, "src/a.ts", "export const a = 1;");
    writeFile(tmpDir, "src/b.ts", "export const b = 2;");

    (complete as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      mockLLMResponse("Module", "desc"),
    );

    await buildIndex(tmpDir);
    let store = loadStore(tmpDir);
    expect(store.files).toHaveLength(2);

    // Delete one file
    fs.unlinkSync(`${tmpDir}/src/b.ts`);

    await buildIndex(tmpDir);
    store = loadStore(tmpDir);
    expect(store.files).toHaveLength(1);
    expect(store.files[0].path).toBe("src/a.ts");
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
              // helper intentionally missing - should keep empty description
            ],
          }),
        },
      ],
    }));

    await buildIndex(tmpDir);
    const store = loadStore(tmpDir);
    const file = store.files[0];

    const userServiceSymbol = file.symbols.find((s) => s.name === "UserService");
    expect(userServiceSymbol?.description).toBe("The main service class");

    const helperSymbol = file.symbols.find((s) => s.name === "helper");
    expect(helperSymbol?.description).toBe("");
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
    const store = loadStore(tmpDir);
    expect(store.files[0].name).toBe("util.ts");
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
    const store = loadStore(tmpDir);
    const file = store.files.find((f) => f.path === "src/data.xyz");
    expect(file).toBeDefined();
    // Falls back to typescript when language is undefined
    expect(file!.language).toBe("typescript");
    // Parser returns null, so imports/exports/symbols are empty
    expect(file!.imports).toEqual([]);
    expect(file!.exports).toEqual([]);
    expect(file!.symbols).toEqual([]);
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
});
