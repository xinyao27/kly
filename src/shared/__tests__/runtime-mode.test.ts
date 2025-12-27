import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ENV_VARS } from "../constants";
import {
  detectMode,
  getLocalRef,
  getRemoteRef,
  isMCP,
  isProgrammatic,
  isSandbox,
  isTrustAll,
} from "../runtime-mode";

describe("runtime-mode", () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all CLAI env vars before each test
    delete process.env[ENV_VARS.SANDBOX_MODE];
    delete process.env[ENV_VARS.MCP_MODE];
    delete process.env[ENV_VARS.PROGRAMMATIC];
    delete process.env[ENV_VARS.TRUST_ALL];
    delete process.env[ENV_VARS.LOCAL_REF];
    delete process.env[ENV_VARS.REMOTE_REF];
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("isSandbox", () => {
    it("returns false when CLAI_SANDBOX_MODE is not set", () => {
      expect(isSandbox()).toBe(false);
    });

    it("returns true when CLAI_SANDBOX_MODE is 'true'", () => {
      process.env[ENV_VARS.SANDBOX_MODE] = "true";
      expect(isSandbox()).toBe(true);
    });

    it("returns false when CLAI_SANDBOX_MODE is any other value", () => {
      process.env[ENV_VARS.SANDBOX_MODE] = "false";
      expect(isSandbox()).toBe(false);

      process.env[ENV_VARS.SANDBOX_MODE] = "1";
      expect(isSandbox()).toBe(false);
    });
  });

  describe("isMCP", () => {
    it("returns false when CLAI_MCP_MODE is not set", () => {
      expect(isMCP()).toBe(false);
    });

    it("returns true when CLAI_MCP_MODE is 'true'", () => {
      process.env[ENV_VARS.MCP_MODE] = "true";
      expect(isMCP()).toBe(true);
    });

    it("returns false when CLAI_MCP_MODE is any other value", () => {
      process.env[ENV_VARS.MCP_MODE] = "false";
      expect(isMCP()).toBe(false);
    });
  });

  describe("isProgrammatic", () => {
    it("returns false when CLAI_PROGRAMMATIC is not set", () => {
      expect(isProgrammatic()).toBe(false);
    });

    it("returns true when CLAI_PROGRAMMATIC is 'true'", () => {
      process.env[ENV_VARS.PROGRAMMATIC] = "true";
      expect(isProgrammatic()).toBe(true);
    });

    it("returns false when CLAI_PROGRAMMATIC is any other value", () => {
      process.env[ENV_VARS.PROGRAMMATIC] = "false";
      expect(isProgrammatic()).toBe(false);
    });
  });

  describe("isTrustAll", () => {
    it("returns false when CLAI_TRUST_ALL is not set", () => {
      expect(isTrustAll()).toBe(false);
    });

    it("returns true when CLAI_TRUST_ALL is 'true'", () => {
      process.env[ENV_VARS.TRUST_ALL] = "true";
      expect(isTrustAll()).toBe(true);
    });

    it("returns false when CLAI_TRUST_ALL is any other value", () => {
      process.env[ENV_VARS.TRUST_ALL] = "false";
      expect(isTrustAll()).toBe(false);
    });
  });

  describe("getLocalRef", () => {
    it("returns undefined when CLAI_LOCAL_REF is not set", () => {
      expect(getLocalRef()).toBeUndefined();
    });

    it("returns the value when CLAI_LOCAL_REF is set", () => {
      process.env[ENV_VARS.LOCAL_REF] = "/path/to/local/script.ts";
      expect(getLocalRef()).toBe("/path/to/local/script.ts");
    });
  });

  describe("getRemoteRef", () => {
    it("returns undefined when CLAI_REMOTE_REF is not set", () => {
      expect(getRemoteRef()).toBeUndefined();
    });

    it("returns the value when CLAI_REMOTE_REF is set", () => {
      process.env[ENV_VARS.REMOTE_REF] = "github.com/owner/repo";
      expect(getRemoteRef()).toBe("github.com/owner/repo");
    });
  });

  describe("detectMode", () => {
    it("returns 'cli' when in sandbox mode", () => {
      process.env[ENV_VARS.SANDBOX_MODE] = "true";
      expect(detectMode()).toBe("cli");
    });

    it("returns 'mcp' when CLAI_MCP_MODE is true", () => {
      process.env[ENV_VARS.MCP_MODE] = "true";
      expect(detectMode()).toBe("mcp");
    });

    it("returns 'programmatic' when CLAI_PROGRAMMATIC is true", () => {
      process.env[ENV_VARS.PROGRAMMATIC] = "true";
      expect(detectMode()).toBe("programmatic");
    });

    it("sandbox mode takes precedence over MCP mode", () => {
      process.env[ENV_VARS.SANDBOX_MODE] = "true";
      process.env[ENV_VARS.MCP_MODE] = "true";
      expect(detectMode()).toBe("cli");
    });

    it("MCP mode takes precedence over programmatic mode", () => {
      process.env[ENV_VARS.MCP_MODE] = "true";
      process.env[ENV_VARS.PROGRAMMATIC] = "true";
      expect(detectMode()).toBe("mcp");
    });

    it("returns 'programmatic' by default when no env vars set", () => {
      // Mock process.argv to not look like a direct run (no .ts/.js extension)
      const originalArgv = process.argv;
      process.argv = ["bun", "node_modules/.bin/somecommand"];

      expect(detectMode()).toBe("programmatic");

      process.argv = originalArgv;
    });
  });
});
