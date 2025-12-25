import { describe, expect, test } from "bun:test";
import { checkEnvVars, validateVersion } from "../resolver";

describe("validateVersion", () => {
  describe(">=x.y.z format", () => {
    test("current equals required → true", () => {
      expect(validateVersion(">=0.1.0", "0.1.0")).toBe(true);
    });

    test("current patch higher → true", () => {
      expect(validateVersion(">=0.1.0", "0.1.1")).toBe(true);
    });

    test("current minor higher → true", () => {
      expect(validateVersion(">=0.1.0", "0.2.0")).toBe(true);
    });

    test("current major higher → true", () => {
      expect(validateVersion(">=0.1.0", "1.0.0")).toBe(true);
    });

    test("current patch lower → false", () => {
      expect(validateVersion(">=0.1.1", "0.1.0")).toBe(false);
    });

    test("current minor lower → false", () => {
      expect(validateVersion(">=0.2.0", "0.1.9")).toBe(false);
    });

    test("current major lower → false", () => {
      expect(validateVersion(">=1.0.0", "0.9.9")).toBe(false);
    });
  });

  describe(">x.y.z format (without equals)", () => {
    test("current equals required → true (treated same as >=)", () => {
      // Our simple parser treats > same as >=
      expect(validateVersion(">0.1.0", "0.1.0")).toBe(true);
    });

    test("current higher → true", () => {
      expect(validateVersion(">0.1.0", "0.1.1")).toBe(true);
    });
  });

  describe("version with spaces", () => {
    test(">= 0.1.0 with space → works", () => {
      expect(validateVersion(">= 0.1.0", "0.1.0")).toBe(true);
    });

    test(">=  0.1.0 with multiple spaces → works", () => {
      expect(validateVersion(">=  0.1.0", "0.2.0")).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("invalid required format → returns true (skip validation)", () => {
      expect(validateVersion("^0.1.0", "0.0.1")).toBe(true);
      expect(validateVersion("~0.1.0", "0.0.1")).toBe(true);
      expect(validateVersion("latest", "0.0.1")).toBe(true);
    });

    test("invalid current format → returns true (skip validation)", () => {
      expect(validateVersion(">=0.1.0", "invalid")).toBe(true);
      expect(validateVersion(">=0.1.0", "")).toBe(true);
    });

    test("high version numbers", () => {
      expect(validateVersion(">=10.20.30", "10.20.30")).toBe(true);
      expect(validateVersion(">=10.20.30", "10.20.29")).toBe(false);
    });
  });

  describe("real-world versions", () => {
    test("0.1.0 satisfies >=0.1.0", () => {
      expect(validateVersion(">=0.1.0", "0.1.0")).toBe(true);
    });

    test("1.0.0 satisfies >=0.1.0", () => {
      expect(validateVersion(">=0.1.0", "1.0.0")).toBe(true);
    });

    test("0.0.9 does not satisfy >=0.1.0", () => {
      expect(validateVersion(">=0.1.0", "0.0.9")).toBe(false);
    });
  });
});

describe("checkEnvVars", () => {
  test("empty required list → empty result", () => {
    expect(checkEnvVars([])).toEqual([]);
  });

  test("existing env var → not in missing list", () => {
    // PATH should always exist
    expect(checkEnvVars(["PATH"])).toEqual([]);
  });

  test("non-existing env var → in missing list", () => {
    expect(checkEnvVars(["DEFINITELY_NOT_EXISTS_12345"])).toEqual([
      "DEFINITELY_NOT_EXISTS_12345",
    ]);
  });

  test("mixed existing and non-existing → only non-existing in result", () => {
    const result = checkEnvVars([
      "PATH",
      "MISSING_VAR_1",
      "HOME",
      "MISSING_VAR_2",
    ]);
    expect(result).toEqual(["MISSING_VAR_1", "MISSING_VAR_2"]);
  });
});
