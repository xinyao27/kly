import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { FileIndex, KlyConfig } from "../../types.js";

export function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kly-test-"));
}

export function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function writeFile(root: string, filePath: string, content: string): void {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

export function createFileIndex(overrides: Partial<FileIndex> = {}): FileIndex {
  return {
    path: "src/example.ts",
    name: "Example Module",
    description: "An example module",
    language: "typescript",
    imports: ["fs"],
    exports: ["example"],
    symbols: [{ name: "example", kind: "function", description: "An example function" }],
    summary: "This is an example module for testing.",
    hash: "abc123",
    indexedAt: Date.now(),
    ...overrides,
  };
}

export function createConfig(overrides: Partial<KlyConfig> = {}): KlyConfig {
  return {
    llm: {
      provider: "openrouter",
      model: "test-model",
      apiKey: "test-key",
    },
    include: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.swift"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/.kly/**",
      "**/vendor/**",
      "**/*.d.ts",
      "**/*.test.*",
      "**/*.spec.*",
      "**/__tests__/**",
    ],
    ...overrides,
  };
}
