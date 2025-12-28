import { defineConfig, type UserConfig } from "tsdown";
import pkg from "./package.json";

const common: UserConfig = {
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
};

export default defineConfig([
  {
    ...common,
    entry: ["src/index.ts"],
    dts: true,
    exports: true,
    publint: true,
    unbundle: true,
  },
  {
    ...common,
    entry: ["bin/kly.ts"],
    outDir: "dist/bin",
    format: "esm",
  },
  {
    // Bundle sandbox executor to avoid circular dependency issues
    ...common,
    entry: { "bundled-executor": "src/sandbox/executor.ts" },
    outDir: "dist/sandbox",
    format: "esm",
    clean: false, // Don't clean dist directory
  },
]);
