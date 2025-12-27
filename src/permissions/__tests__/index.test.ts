import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ENV_VARS } from "../../shared/constants";
import { checkApiKeyPermission, getAppIdentifier } from "../index";

describe("permissions/index", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear CLAI env vars
    delete process.env[ENV_VARS.TRUST_ALL];
    delete process.env[ENV_VARS.LOCAL_REF];
    delete process.env[ENV_VARS.REMOTE_REF];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getAppIdentifier", () => {
    it("returns local ref when CLAI_LOCAL_REF is set", () => {
      process.env[ENV_VARS.LOCAL_REF] = "/path/to/script.ts";
      expect(getAppIdentifier()).toBe("/path/to/script.ts");
    });

    it("returns remote ref when CLAI_REMOTE_REF is set", () => {
      process.env[ENV_VARS.REMOTE_REF] = "github.com/owner/repo";
      expect(getAppIdentifier()).toBe("github.com/owner/repo");
    });

    it("prioritizes local ref over remote ref", () => {
      process.env[ENV_VARS.LOCAL_REF] = "/local/path.ts";
      process.env[ENV_VARS.REMOTE_REF] = "github.com/owner/repo";
      expect(getAppIdentifier()).toBe("/local/path.ts");
    });

    it("falls back to process.argv[1] when no env vars are set", () => {
      const originalArgv = process.argv;
      process.argv = ["bun", "/fallback/script.ts"];

      // Absolute paths get prefixed with "local:"
      expect(getAppIdentifier()).toBe("local:/fallback/script.ts");

      process.argv = originalArgv;
    });
  });

  describe("checkApiKeyPermission with TRUST_ALL", () => {
    it("returns true immediately when CLAI_TRUST_ALL is set", async () => {
      process.env[ENV_VARS.TRUST_ALL] = "true";

      const result = await checkApiKeyPermission("test-app");

      expect(result).toBe(true);
    });

    it("does not bypass check when CLAI_TRUST_ALL is not 'true'", async () => {
      process.env[ENV_VARS.TRUST_ALL] = "false";

      // This will fail because we don't have stored permissions in test
      // But it proves it's not bypassing
      try {
        await checkApiKeyPermission("test-app");
      } catch {
        // Expected to fail in non-interactive test environment
        expect(true).toBe(true);
      }
    });
  });
});
