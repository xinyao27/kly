import { describe, expect, it, mock } from "bun:test";
import { autocompleteMultiselect } from "../components/autocompleteMultiselect";

// Mock isTTY to avoid interactive prompts in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false,
}));

describe("autocompleteMultiselect (non-TTY mode)", () => {
  it("returns empty array when no initial values", async () => {
    const result = await autocompleteMultiselect({
      options: [
        { name: "Apple", value: "apple" },
        { name: "Banana", value: "banana" },
      ],
      prompt: "Search and select fruits",
    });

    expect(result).toEqual([]);
  });

  it("returns initial values in non-TTY mode", async () => {
    const result = await autocompleteMultiselect({
      options: [
        { name: "Apple", value: "apple" },
        { name: "Banana", value: "banana" },
        { name: "Cherry", value: "cherry" },
      ],
      initialValues: ["apple", "cherry"],
    });

    expect(result).toEqual(["apple", "cherry"]);
  });

  it("works with typed values", async () => {
    const result = await autocompleteMultiselect<number>({
      options: [
        { name: "One", value: 1 },
        { name: "Two", value: 2 },
        { name: "Three", value: 3 },
      ],
      initialValues: [1, 3],
    });

    expect(result).toEqual([1, 3]);
  });

  it("handles options with descriptions", async () => {
    const result = await autocompleteMultiselect({
      options: [
        { name: "TypeScript", value: "ts", description: "Type-safe" },
        { name: "JavaScript", value: "js", description: "Dynamic" },
      ],
      initialValues: ["ts"],
    });

    expect(result).toEqual(["ts"]);
  });
});
