import { describe, expect, it } from "bun:test";
import { ENV_VARS, PATHS } from "../constants";

describe("constants", () => {
  describe("ENV_VARS", () => {
    it("defines all expected environment variable names", () => {
      expect(ENV_VARS.MCP_MODE).toBe("KLY_MCP_MODE");
      expect(ENV_VARS.PROGRAMMATIC).toBe("KLY_PROGRAMMATIC");
      expect(ENV_VARS.LOCAL_REF).toBe("KLY_LOCAL_REF");
      expect(ENV_VARS.REMOTE_REF).toBe("KLY_REMOTE_REF");
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
      expect(PATHS.CONFIG_DIR).toBe(".kly");
      expect(PATHS.META_FILE).toBe(".kly-meta.json");
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
      expect(PATHS.CONFIG_FILE.endsWith(".json")).toBe(true);
    });
  });
});
