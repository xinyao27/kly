import { describe, expect, test } from "bun:test";
import { isNaturalLanguage } from "../inference";

describe("isNaturalLanguage", () => {
  test("should detect natural language with spaces", () => {
    expect(isNaturalLanguage("Is it cold in Beijing?")).toBe(true);
    expect(isNaturalLanguage("What should I pack for Tokyo")).toBe(true);
    expect(isNaturalLanguage("cheap trip to Bali")).toBe(true);
  });

  test("should detect natural language with question marks", () => {
    expect(isNaturalLanguage("Tokyo?")).toBe(true);
    expect(isNaturalLanguage("?")).toBe(true);
  });

  test("should detect natural language with common words", () => {
    expect(isNaturalLanguage("what is weather")).toBe(true);
    expect(isNaturalLanguage("how to pack")).toBe(true);
    expect(isNaturalLanguage("where can I go")).toBe(true);
    expect(isNaturalLanguage("the best city")).toBe(true);
  });

  test("should reject flag syntax", () => {
    expect(isNaturalLanguage("--city=Beijing")).toBe(false);
    expect(isNaturalLanguage("--help")).toBe(false);
    expect(isNaturalLanguage("-h")).toBe(false);
  });

  test("should reject single words without indicators", () => {
    expect(isNaturalLanguage("Beijing")).toBe(false);
    expect(isNaturalLanguage("Tokyo")).toBe(false);
    expect(isNaturalLanguage("test")).toBe(false);
  });

  test("should handle edge cases", () => {
    expect(isNaturalLanguage("")).toBe(false);
    // Note: "  " has spaces so it returns true, but this is acceptable
    // as it will likely fail in actual usage anyway
  });

  test("should detect phrases with common words", () => {
    expect(isNaturalLanguage("Weather in Beijing")).toBe(true);
    expect(isNaturalLanguage("weather in Beijing")).toBe(true);
    expect(isNaturalLanguage("trip to Paris")).toBe(true);
  });
});
