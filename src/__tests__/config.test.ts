import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ensureGitignore,
  getConfigPath,
  getDbDir,
  getDbPath,
  getKlyDir,
  getStatePath,
  hashConfig,
  initKlyDir,
  isInitialized,
  loadConfig,
} from "../config";
import { cleanupTempDir, createTempDir } from "./helpers/fixtures";

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

  describe("getDbDir", () => {
    it("should return root/.kly/db", () => {
      expect(getDbDir(tmpDir)).toBe(path.join(tmpDir, ".kly", "db"));
    });
  });

  describe("getDbPath", () => {
    it("should return root/.kly/db/<name>.db", () => {
      expect(getDbPath(tmpDir, "main")).toBe(path.join(tmpDir, ".kly", "db", "main.db"));
    });
  });

  describe("getStatePath", () => {
    it("should return root/.kly/state.yaml", () => {
      expect(getStatePath(tmpDir)).toBe(path.join(tmpDir, ".kly", "state.yaml"));
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
    it("should create .kly directory, config.yaml, and db directory", () => {
      initKlyDir(tmpDir);
      expect(fs.existsSync(getKlyDir(tmpDir))).toBe(true);
      expect(fs.existsSync(getConfigPath(tmpDir))).toBe(true);
      expect(fs.existsSync(getDbDir(tmpDir))).toBe(true);
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

    it("should create .gitignore with .kly in a git repo when none exists", () => {
      fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
      initKlyDir(tmpDir);
      const gitignorePath = path.join(tmpDir, ".gitignore");
      expect(fs.existsSync(gitignorePath)).toBe(true);
      expect(fs.readFileSync(gitignorePath, "utf-8")).toBe(".kly\n");
    });

    it("should append .kly to existing .gitignore in a git repo", () => {
      fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules\n", "utf-8");
      initKlyDir(tmpDir);
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("node_modules\n.kly\n");
    });

    it("should not duplicate .kly when already in .gitignore", () => {
      fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules\n.kly\n", "utf-8");
      initKlyDir(tmpDir);
      initKlyDir(tmpDir);
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("node_modules\n.kly\n");
    });

    it("should not create or modify .gitignore when not a git repo", () => {
      initKlyDir(tmpDir);
      expect(fs.existsSync(path.join(tmpDir, ".gitignore"))).toBe(false);
    });
  });

  describe("ensureGitignore", () => {
    it("is a no-op without .git", () => {
      ensureGitignore(tmpDir);
      expect(fs.existsSync(path.join(tmpDir, ".gitignore"))).toBe(false);
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
      const klyDir = getKlyDir(tmpDir);
      fs.mkdirSync(klyDir, { recursive: true });
      fs.writeFileSync(getConfigPath(tmpDir), "llm:\n  provider: google\n", "utf-8");
      const config = loadConfig(tmpDir);
      expect(config.llm.provider).toBe("google");
      expect(config.llm.model).toBe("anthropic/claude-haiku-4.5");
    });
  });

  describe("hashConfig", () => {
    it("should return consistent hash for same config", () => {
      const config = loadConfig(tmpDir);
      expect(hashConfig(config)).toBe(hashConfig(config));
    });

    it("should change when include/exclude changes", () => {
      const config1 = { ...loadConfig(tmpDir) };
      const config2 = { ...config1, include: ["**/*.py"] };
      expect(hashConfig(config1)).not.toBe(hashConfig(config2));
    });

    it("should not change when only llm config changes", () => {
      const config1 = loadConfig(tmpDir);
      const config2 = {
        ...config1,
        llm: { ...config1.llm, apiKey: "different" },
      };
      expect(hashConfig(config1)).toBe(hashConfig(config2));
    });
  });
});
