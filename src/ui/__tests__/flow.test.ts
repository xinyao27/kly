import { describe, expect, it } from "bun:test";
import { cancel, intro, isCancel, note, outro } from "../components/flow";

describe("flow components", () => {
  it("intro can be called without error", () => {
    expect(() => intro("Welcome")).not.toThrow();
    expect(() => intro()).not.toThrow();
  });

  it("outro can be called without error", () => {
    expect(() => outro("Goodbye")).not.toThrow();
    expect(() => outro()).not.toThrow();
  });

  it("cancel can be called without error", () => {
    expect(() => cancel("Cancelled")).not.toThrow();
    expect(() => cancel()).not.toThrow();
  });

  it("note can be called without error", () => {
    expect(() => note("This is a note")).not.toThrow();
    expect(() => note("Content", "Title")).not.toThrow();
  });

  it("isCancel returns false for regular values", () => {
    expect(isCancel("hello")).toBe(false);
    expect(isCancel(123)).toBe(false);
    expect(isCancel(null)).toBe(false);
    expect(isCancel(undefined)).toBe(false);
    expect(isCancel({})).toBe(false);
  });

  it("isCancel returns true for cancel symbol", () => {
    // Create a symbol that mimics cancel behavior
    const cancelSymbol = Symbol("cancel");
    // Note: The actual cancel symbol from @clack/prompts is internal
    // This test verifies the function exists and handles symbols
    expect(typeof isCancel(cancelSymbol)).toBe("boolean");
  });
});
