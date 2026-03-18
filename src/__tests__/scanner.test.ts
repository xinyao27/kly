import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scanFiles } from "../scanner.js";
import { cleanupTempDir, createConfig, createTempDir, writeFile } from "./helpers/fixtures.js";

describe("scanner", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("should return empty array for empty directory", async () => {
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).toEqual([]);
  });

  it("should find TypeScript files", async () => {
    writeFile(tmpDir, "src/index.ts", "export {}");
    writeFile(tmpDir, "src/app.tsx", "export {}");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).toContain("src/index.ts");
    expect(files).toContain("src/app.tsx");
  });

  it("should find JavaScript files", async () => {
    writeFile(tmpDir, "lib/util.js", "module.exports = {}");
    writeFile(tmpDir, "lib/app.jsx", "export default {}");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).toContain("lib/util.js");
    expect(files).toContain("lib/app.jsx");
  });

  it("should find Swift files", async () => {
    writeFile(tmpDir, "Sources/main.swift", "import Foundation");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).toContain("Sources/main.swift");
  });

  it("should exclude node_modules", async () => {
    writeFile(tmpDir, "node_modules/pkg/index.ts", "export {}");
    writeFile(tmpDir, "src/index.ts", "export {}");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).not.toContain("node_modules/pkg/index.ts");
    expect(files).toContain("src/index.ts");
  });

  it("should exclude dist directory", async () => {
    writeFile(tmpDir, "dist/index.ts", "export {}");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).not.toContain("dist/index.ts");
  });

  it("should exclude .d.ts files", async () => {
    writeFile(tmpDir, "src/types.d.ts", "declare module 'x'");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).not.toContain("src/types.d.ts");
  });

  it("should exclude test files", async () => {
    writeFile(tmpDir, "src/foo.test.ts", "test('x', () => {})");
    writeFile(tmpDir, "src/foo.spec.ts", "test('x', () => {})");
    writeFile(tmpDir, "src/__tests__/bar.ts", "test('x', () => {})");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).toHaveLength(0);
  });

  it("should return sorted relative paths", async () => {
    writeFile(tmpDir, "src/z.ts", "");
    writeFile(tmpDir, "src/a.ts", "");
    writeFile(tmpDir, "src/m.ts", "");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).toEqual(["src/a.ts", "src/m.ts", "src/z.ts"]);
  });

  it("should handle nested directory files correctly", async () => {
    writeFile(tmpDir, "src/deep/nested/file.ts", "export {}");
    const config = createConfig();
    const files = await scanFiles(tmpDir, config);
    expect(files).toContain("src/deep/nested/file.ts");
  });
});
