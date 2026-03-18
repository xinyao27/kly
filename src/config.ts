import fs from "node:fs";
import path from "node:path";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { KlyConfig } from "./types.js";

const KLY_DIR = ".kly";
const CONFIG_FILE = "config.yaml";
const INDEX_FILE = "index.yaml";

const DEFAULT_CONFIG: KlyConfig = {
  llm: {
    provider: "openrouter",
    model: "anthropic/claude-haiku-4.5",
    apiKey: "",
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
};

export function getKlyDir(root: string): string {
  return path.join(root, KLY_DIR);
}

export function getConfigPath(root: string): string {
  return path.join(getKlyDir(root), CONFIG_FILE);
}

export function getIndexPath(root: string): string {
  return path.join(getKlyDir(root), INDEX_FILE);
}

export function isInitialized(root: string): boolean {
  return fs.existsSync(getKlyDir(root));
}

export function initKlyDir(root: string, config?: KlyConfig): void {
  const klyDir = getKlyDir(root);
  if (!fs.existsSync(klyDir)) {
    fs.mkdirSync(klyDir, { recursive: true });
  }

  const configToWrite = config || DEFAULT_CONFIG;
  fs.writeFileSync(getConfigPath(root), stringifyYaml(configToWrite), "utf-8");
}

export function loadConfig(root: string): KlyConfig {
  const configPath = getConfigPath(root);
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = parseYaml(raw) as Partial<KlyConfig>;

  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
  };
}
