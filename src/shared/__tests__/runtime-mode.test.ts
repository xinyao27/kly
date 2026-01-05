import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ENV_VARS } from "../constants";
import { detectMode, getLocalRef, getRemoteRef, isMCP, isProgrammatic } from "../runtime-mode";

describe("runtime-mode", () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all KLY env vars before each test
    delete process.env[ENV_VARS.MCP_MODE];
    delete process.env[ENV_VARS.PROGRAMMATIC];
    delete process.env[ENV_VARS.LOCAL_REF];
    delete process.env[ENV_VARS.REMOTE_REF];
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("isMCP", () => {
    it("returns false when KLY_MCP_MODE is not set", () => {
      expect(isMCP()).toBe(false);
    });

    it("returns true when KLY_MCP_MODE is 'true'", () => {
      process.env[ENV_VARS.MCP_MODE] = "true";
      expect(isMCP()).toBe(true);
    });

    it("returns false when KLY_MCP_MODE is any other value", () => {
      process.env[ENV_VARS.MCP_MODE] = "false";
      expect(isMCP()).toBe(false);
    });
  });

  describe("isProgrammatic", () => {
    it("returns false when KLY_PROGRAMMATIC is not set", () => {
      expect(isProgrammatic()).toBe(false);
    });

    it("returns true when KLY_PROGRAMMATIC is 'true'", () => {
      process.env[ENV_VARS.PROGRAMMATIC] = "true";
      expect(isProgrammatic()).toBe(true);
    });

    it("returns false when KLY_PROGRAMMATIC is any other value", () => {
      process.env[ENV_VARS.PROGRAMMATIC] = "false";
      expect(isProgrammatic()).toBe(false);
    });
  });

  describe("getLocalRef", () => {
    it("returns undefined when KLY_LOCAL_REF is not set", () => {
      expect(getLocalRef()).toBeUndefined();
    });

    it("returns the value when KLY_LOCAL_REF is set", () => {
      process.env[ENV_VARS.LOCAL_REF] = "/path/to/local/script.ts";
      expect(getLocalRef()).toBe("/path/to/local/script.ts");
    });
  });

  describe("getRemoteRef", () => {
    it("returns undefined when KLY_REMOTE_REF is not set", () => {
      expect(getRemoteRef()).toBeUndefined();
    });

    it("returns the value when KLY_REMOTE_REF is set", () => {
      process.env[ENV_VARS.REMOTE_REF] = "github.com/owner/repo";
      expect(getRemoteRef()).toBe("github.com/owner/repo");
    });
  });

  describe("detectMode", () => {
    it("returns 'mcp' when KLY_MCP_MODE is true", () => {
      process.env[ENV_VARS.MCP_MODE] = "true";
      expect(detectMode()).toBe("mcp");
    });

    it("returns 'programmatic' when KLY_PROGRAMMATIC is true", () => {
      process.env[ENV_VARS.PROGRAMMATIC] = "true";
      expect(detectMode()).toBe("programmatic");
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
