import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getConfigPath,
  getIndexPath,
  getKlyDir,
  initKlyDir,
  isInitialized,
  loadConfig,
} from "../config.js";
import { cleanupTempDir, createTempDir } from "./helpers/fixtures.js";

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe("getKlyDir", () => {
    it("should return root/.kly path", () => {
      expect(getKlyDir(tmpDir)).toBe(path.join(tmpDir, ".kly"));
    });
  });

  describe("getConfigPath", () => {
    it("should return root/.kly/config.yaml", () => {
      expect(getConfigPath(tmpDir)).toBe(path.join(tmpDir, ".kly", "config.yaml"));
    });
  });

  describe("getIndexPath", () => {
    it("should return root/.kly/index.yaml", () => {
      expect(getIndexPath(tmpDir)).toBe(path.join(tmpDir, ".kly", "index.yaml"));
    });
  });

  describe("isInitialized", () => {
    it("should return false when .kly does not exist", () => {
      expect(isInitialized(tmpDir)).toBe(false);
    });

    it("should return true after initialization", () => {
      initKlyDir(tmpDir);
      expect(isInitialized(tmpDir)).toBe(true);
    });
  });

  describe("initKlyDir", () => {
    it("should create .kly directory and config.yaml", () => {
      initKlyDir(tmpDir);
      expect(fs.existsSync(getKlyDir(tmpDir))).toBe(true);
      expect(fs.existsSync(getConfigPath(tmpDir))).toBe(true);
    });

    it("should write default config as YAML", () => {
      initKlyDir(tmpDir);
      const content = fs.readFileSync(getConfigPath(tmpDir), "utf-8");
      expect(content).toContain("provider:");
      expect(content).toContain("model:");
    });

    it("should accept custom config", () => {
      const customConfig = {
        llm: { provider: "anthropic", model: "claude-3", apiKey: "sk-test" },
        include: ["**/*.ts"],
        exclude: ["**/dist/**"],
      };
      initKlyDir(tmpDir, customConfig);
      const config = loadConfig(tmpDir);
      expect(config.llm.provider).toBe("anthropic");
      expect(config.llm.model).toBe("claude-3");
    });

    it("should be idempotent", () => {
      initKlyDir(tmpDir);
      initKlyDir(tmpDir);
      expect(fs.existsSync(getConfigPath(tmpDir))).toBe(true);
    });
  });

  describe("loadConfig", () => {
    it("should return default config when no file exists", () => {
      const config = loadConfig(tmpDir);
      expect(config.llm.provider).toBe("openrouter");
      expect(config.include).toContain("**/*.ts");
      expect(config.exclude).toContain("**/node_modules/**");
    });

    it("should merge partial config with defaults", () => {
      initKlyDir(tmpDir, {
        llm: { provider: "anthropic", model: "", apiKey: "" },
        include: ["**/*.py"],
        exclude: [],
      });
      const config = loadConfig(tmpDir);
      expect(config.llm.provider).toBe("anthropic");
      expect(config.include).toEqual(["**/*.py"]);
    });

    it("should deep merge llm section with defaults", () => {
      // Write a config with only provider set
      const klyDir = getKlyDir(tmpDir);
      fs.mkdirSync(klyDir, { recursive: true });
      fs.writeFileSync(getConfigPath(tmpDir), "llm:\n  provider: google\n", "utf-8");
      const config = loadConfig(tmpDir);
      expect(config.llm.provider).toBe("google");
      // model should come from default
      expect(config.llm.model).toBe("anthropic/claude-haiku-4-5-20251001");
    });
  });
});
