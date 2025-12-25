import { describe, expect, it, mock } from "bun:test";
import { select } from "../components/select";

// Mock isTTY to avoid interactive prompts in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false, // Always non-TTY for tests
}));

describe("select (non-TTY mode)", () => {
  it("auto-selects first option in non-TTY mode", async () => {
    const result = await select({
      options: [
        { name: "Red", value: "red" },
        { name: "Blue", value: "blue" },
      ],
      prompt: "Pick a color",
    });

    expect(result).toBe("red");
  });

  it("returns first option with description", async () => {
    const result = await select({
      options: [
        { name: "Red", value: "red", description: "Warm color" },
        { name: "Blue", value: "blue", description: "Cool color" },
      ],
    });

    expect(result).toBe("red");
  });

  it("throws error if no options provided", async () => {
    expect(
      select({
        options: [],
      }),
    ).rejects.toThrow("No options provided");
  });
});
