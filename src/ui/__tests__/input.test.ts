import { describe, expect, it, mock } from "bun:test";
import { input } from "../components/input";

// Mock isTTY to avoid interactive prompts in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false, // Always non-TTY for tests
}));

describe("input (non-TTY mode)", () => {
  it("returns default value in non-TTY mode", async () => {
    const result = await input({
      prompt: "Enter name",
      defaultValue: "Alice",
    });

    expect(result).toBe("Alice");
  });

  it("throws error if no default value provided in non-TTY mode", async () => {
    expect(
      input({
        prompt: "Enter name",
      }),
    ).rejects.toThrow("Interactive input not available in non-TTY mode");
  });
});
