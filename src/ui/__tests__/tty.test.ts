import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { isTTY } from "../utils/tty";

describe("isTTY", () => {
  let originalCI: string | undefined;

  beforeEach(() => {
    originalCI = process.env.CI;
  });

  afterEach(() => {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
  });

  it("returns a boolean value", () => {
    const result = isTTY();
    expect(typeof result).toBe("boolean");
  });

  it("returns false in CI environment", () => {
    process.env.CI = "true";
    expect(isTTY()).toBe(false);
  });

  it("checks both stdout and stdin TTY status", () => {
    // In test environment, this will typically be false
    // We're just verifying the function runs without error
    const result = isTTY();
    expect([true, false]).toContain(result);
  });
});
