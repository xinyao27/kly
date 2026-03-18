import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      include: [
        "src/config.ts",
        "src/scanner.ts",
        "src/hasher.ts",
        "src/store.ts",
        "src/query.ts",
        "src/indexer.ts",
        "src/parser/**/*.ts",
        "src/llm/**/*.ts",
      ],
      exclude: ["src/__tests__/**"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    entry: {
      index: "src/index.ts",
      cli: "src/cli.ts",
      mcp: "src/mcp.ts",
    },
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
