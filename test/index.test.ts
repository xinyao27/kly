/* agent-frontmatter:start
AGENT: Tests for Clai core functionality
PURPOSE: Verify defineApp and CLI parsing work correctly
USAGE: bun test
EXPORTS: none (test file)
FEATURES:
  - Test CLI argument parsing
  - Test validation errors
SEARCHABLE: test, spec, cli, parser
agent-frontmatter:end */

import { describe, expect, it } from "bun:test";
import { parseCliArgs } from "../src/cli";

describe("parseCliArgs", () => {
  it("parses --key=value format", () => {
    const result = parseCliArgs(["--name=World"]);
    expect(result).toEqual({ name: "World" });
  });

  it("parses --key value format", () => {
    const result = parseCliArgs(["--name", "World"]);
    expect(result).toEqual({ name: "World" });
  });

  it("parses boolean flags", () => {
    const result = parseCliArgs(["--excited"]);
    expect(result).toEqual({ excited: true });
  });

  it("parses --no-flag as false", () => {
    const result = parseCliArgs(["--no-excited"]);
    expect(result).toEqual({ excited: false });
  });

  it("coerces numbers", () => {
    const result = parseCliArgs(["--count=42"]);
    expect(result).toEqual({ count: 42 });
  });

  it("coerces boolean strings", () => {
    const result = parseCliArgs(["--flag=true", "--other=false"]);
    expect(result).toEqual({ flag: true, other: false });
  });

  it("handles mixed arguments", () => {
    const result = parseCliArgs([
      "--name=World",
      "--excited",
      "--count",
      "5",
      "--no-verbose",
    ]);
    expect(result).toEqual({
      name: "World",
      excited: true,
      count: 5,
      verbose: false,
    });
  });
});
