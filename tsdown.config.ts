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
]);
