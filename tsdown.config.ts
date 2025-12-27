import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    dts: true,
    exports: true,
    publint: true,
    unbundle: true,
  },
  {
    entry: ["bin/clai.ts"],
    outDir: "dist/bin",
    format: "esm",
  },
  {
    // Bundle sandbox executor to avoid circular dependency issues
    entry: { "bundled-executor": "src/sandbox/executor.ts" },
    outDir: "dist/sandbox",
    format: "esm",
    clean: false, // Don't clean dist directory
  },
]);
