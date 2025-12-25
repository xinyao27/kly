import { describe, expect, it, mock } from "bun:test";
import { autocomplete } from "../components/autocomplete";

// Mock isTTY to avoid interactive prompts in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false,
}));

describe("autocomplete (non-TTY mode)", () => {
  it("returns first option in non-TTY mode", async () => {
    const result = await autocomplete({
      options: [
        { name: "Apple", value: "apple" },
        { name: "Banana", value: "banana" },
      ],
      prompt: "Search fruits",
    });

    expect(result).toBe("apple");
  });

  it("returns first option with description", async () => {
    const result = await autocomplete({
      options: [
        { name: "TypeScript", value: "ts", description: "Type-safe JS" },
        { name: "JavaScript", value: "js", description: "Dynamic language" },
      ],
    });

    expect(result).toBe("ts");
  });

  it("throws error if no options provided", async () => {
    expect(
      autocomplete({
        options: [],
      }),
    ).rejects.toThrow("No options provided");
  });

  it("works with typed values", async () => {
    const result = await autocomplete<number>({
      options: [
        { name: "One", value: 1 },
        { name: "Two", value: 2 },
      ],
    });

    expect(result).toBe(1);
  });
});
