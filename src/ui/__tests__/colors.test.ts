import { describe, expect, it } from "bun:test";
import pc from "picocolors";
import { formatText, theme } from "../utils/colors";

describe("theme", () => {
  it("exports color constants", () => {
    expect(theme.primary).toBe("#3b82f6");
    expect(theme.success).toBe("#10b981");
    expect(theme.error).toBe("#ef4444");
    expect(theme.background).toBe("#161b22");
  });
});

describe("formatText", () => {
  it("returns plain text with no options", () => {
    expect(formatText("hello")).toBe("hello");
  });

  it("applies bold formatting", () => {
    expect(formatText("hello", { bold: true })).toBe(pc.bold("hello"));
  });

  it("applies dim formatting", () => {
    expect(formatText("hello", { dim: true })).toBe(pc.dim("hello"));
  });

  it("applies italic formatting", () => {
    expect(formatText("hello", { italic: true })).toBe(pc.italic("hello"));
  });

  it("applies underline formatting", () => {
    expect(formatText("hello", { underline: true })).toBe(
      pc.underline("hello"),
    );
  });

  it("applies color formatting", () => {
    expect(formatText("hello", { color: "red" })).toBe(pc.red("hello"));
    expect(formatText("hello", { color: "cyan" })).toBe(pc.cyan("hello"));
  });

  it("applies multiple formats", () => {
    expect(formatText("hello", { bold: true, italic: true })).toBe(
      pc.italic(pc.bold("hello")),
    );
  });

  it("applies color with styles", () => {
    expect(formatText("hello", { color: "green", bold: true })).toBe(
      pc.bold(pc.green("hello")),
    );
  });
});
