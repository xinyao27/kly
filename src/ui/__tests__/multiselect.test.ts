import { describe, expect, it, mock } from "bun:test";
import { multiselect } from "../components/multiselect";

// Mock isTTY to avoid interactive prompts in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false,
}));

describe("multiselect (non-TTY mode)", () => {
  it("returns empty array when no initial values", async () => {
    const result = await multiselect({
      options: [
        { name: "Red", value: "red" },
        { name: "Blue", value: "blue" },
      ],
      prompt: "Pick colors",
    });

    expect(result).toEqual([]);
  });

  it("returns initial values in non-TTY mode", async () => {
    const result = await multiselect({
      options: [
        { name: "Red", value: "red" },
        { name: "Blue", value: "blue" },
        { name: "Green", value: "green" },
      ],
      initialValues: ["red", "green"],
    });

    expect(result).toEqual(["red", "green"]);
  });

  it("works with typed values", async () => {
    const result = await multiselect<number>({
      options: [
        { name: "One", value: 1 },
        { name: "Two", value: 2 },
        { name: "Three", value: 3 },
      ],
      initialValues: [1, 3],
    });

    expect(result).toEqual([1, 3]);
  });
});
