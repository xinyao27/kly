import { describe, expect, it, mock } from "bun:test";
import { password } from "../components/password";

// Mock isTTY to avoid interactive prompts in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false,
}));

describe("password (non-TTY mode)", () => {
  it("throws error in non-TTY mode", async () => {
    expect(
      password({
        prompt: "Enter password",
      }),
    ).rejects.toThrow("Password input not available in non-TTY mode");
  });
});
