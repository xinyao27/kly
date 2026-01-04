import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { form } from "../components/form";

// Mock isTTY to avoid interactive prompts in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false, // Always non-TTY for tests
}));

describe("form (non-TTY mode)", () => {
  const originalLog = console.log;
  let logOutput: string[] = [];

  beforeEach(() => {
    logOutput = [];
    console.log = (...args: unknown[]) => {
      logOutput.push(args.join(" "));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it("collects form values with defaults in non-TTY mode", async () => {
    const result = await form({
      title: "Registration",
      fields: [
        { name: "name", label: "Name", type: "string", defaultValue: "Alice" },
        { name: "age", label: "Age", type: "number", defaultValue: 25 },
      ],
    });

    expect(result.name).toBe("Alice");
    expect(result.age).toBe(25);
  });

  it("displays form title", async () => {
    await form({
      title: "My Form",
      fields: [{ name: "field1", label: "Field 1", type: "string", defaultValue: "a" }],
    });

    expect(logOutput.some((line) => line.includes("My Form"))).toBe(true);
  });
});
