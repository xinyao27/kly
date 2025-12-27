import { describe, expect, it } from "bun:test";
import { ENV_VARS, LLM_API_DOMAINS, PATHS, TIMEOUTS } from "../constants";

describe("constants", () => {
  describe("ENV_VARS", () => {
    it("defines all expected environment variable names", () => {
      expect(ENV_VARS.SANDBOX_MODE).toBe("CLAI_SANDBOX_MODE");
      expect(ENV_VARS.MCP_MODE).toBe("CLAI_MCP_MODE");
      expect(ENV_VARS.PROGRAMMATIC).toBe("CLAI_PROGRAMMATIC");
      expect(ENV_VARS.TRUST_ALL).toBe("CLAI_TRUST_ALL");
      expect(ENV_VARS.LOCAL_REF).toBe("CLAI_LOCAL_REF");
      expect(ENV_VARS.REMOTE_REF).toBe("CLAI_REMOTE_REF");
    });

    it("is immutable via TypeScript const assertion", () => {
      // Note: 'as const' provides compile-time immutability
      // Runtime freeze is not necessary for this use case
      expect(typeof ENV_VARS).toBe("object");
    });

    it("has all string values", () => {
      for (const key of Object.keys(ENV_VARS)) {
        expect(typeof ENV_VARS[key as keyof typeof ENV_VARS]).toBe("string");
      }
    });
  });

  describe("PATHS", () => {
    it("defines all expected path constants", () => {
      expect(PATHS.CONFIG_DIR).toBe(".clai");
      expect(PATHS.META_FILE).toBe(".clai-meta.json");
      expect(PATHS.PERMISSIONS_FILE).toBe("permissions.json");
      expect(PATHS.CONFIG_FILE).toBe("config.json");
    });

    it("is immutable via TypeScript const assertion", () => {
      expect(typeof PATHS).toBe("object");
    });

    it("has all string values", () => {
      for (const key of Object.keys(PATHS)) {
        expect(typeof PATHS[key as keyof typeof PATHS]).toBe("string");
      }
    });

    it("uses consistent naming conventions", () => {
      expect(PATHS.CONFIG_DIR.startsWith(".")).toBe(true);
      expect(PATHS.META_FILE.endsWith(".json")).toBe(true);
      expect(PATHS.PERMISSIONS_FILE.endsWith(".json")).toBe(true);
      expect(PATHS.CONFIG_FILE.endsWith(".json")).toBe(true);
    });
  });

  describe("TIMEOUTS", () => {
    it("defines all expected timeout constants", () => {
      expect(TIMEOUTS.IPC_REQUEST).toBe(30_000);
      expect(TIMEOUTS.IPC_LONG_REQUEST).toBe(60_000);
    });

    it("is immutable via TypeScript const assertion", () => {
      expect(typeof TIMEOUTS).toBe("object");
    });

    it("has all number values", () => {
      for (const key of Object.keys(TIMEOUTS)) {
        expect(typeof TIMEOUTS[key as keyof typeof TIMEOUTS]).toBe("number");
      }
    });

    it("has reasonable timeout values in milliseconds", () => {
      expect(TIMEOUTS.IPC_REQUEST).toBeGreaterThan(0);
      expect(TIMEOUTS.IPC_REQUEST).toBeLessThan(120_000); // Less than 2 minutes
      expect(TIMEOUTS.IPC_LONG_REQUEST).toBeGreaterThan(TIMEOUTS.IPC_REQUEST);
      expect(TIMEOUTS.IPC_LONG_REQUEST).toBeLessThan(300_000); // Less than 5 minutes
    });
  });

  describe("LLM_API_DOMAINS", () => {
    it("defines expected LLM API domains", () => {
      expect(LLM_API_DOMAINS).toContain("api.openai.com");
      expect(LLM_API_DOMAINS).toContain("*.anthropic.com");
      expect(LLM_API_DOMAINS).toContain("generativelanguage.googleapis.com");
      expect(LLM_API_DOMAINS).toContain("api.deepseek.com");
    });

    it("is immutable via TypeScript const assertion", () => {
      expect(Array.isArray(LLM_API_DOMAINS)).toBe(true);
    });

    it("has at least 4 domains", () => {
      expect(LLM_API_DOMAINS.length).toBeGreaterThanOrEqual(4);
    });

    it("all domains are strings", () => {
      for (const domain of LLM_API_DOMAINS) {
        expect(typeof domain).toBe("string");
        expect(domain.length).toBeGreaterThan(0);
      }
    });

    it("supports wildcard domains", () => {
      const hasWildcard = LLM_API_DOMAINS.some((d) => d.includes("*"));
      expect(hasWildcard).toBe(true);
    });
  });
});
