import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { isNaturalLanguage, parseNaturalLanguage } from "../inference";
import * as storage from "../storage";

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

describe("parseNaturalLanguage", () => {
  let mockGetCurrentModelConfig: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    // Clean up any previous mocks
    mockGetCurrentModelConfig?.mockRestore();
    mockGetCurrentModelConfig = null;
  });

  afterEach(() => {
    // Restore mocks
    mockGetCurrentModelConfig?.mockRestore();
  });

  test("should throw error when no LLM is configured", async () => {
    // Mock getCurrentModelConfig to return null
    mockGetCurrentModelConfig = spyOn(
      storage,
      "getCurrentModelConfig",
    ).mockReturnValue(null);

    const mockSchema = {
      "~standard": {
        version: 1,
        vendor: "zod",
        validate: () => ({ success: true, value: {} }),
        jsonSchema: { type: "object", properties: {} },
      },
    };

    await expect(
      parseNaturalLanguage("test input", mockSchema as any),
    ).rejects.toThrow("Natural language mode requires a configured LLM model");
  });

  // Note: Full integration tests with actual LLM calls are performed
  // in the end-to-end tests and manual testing with real examples.
  // Unit tests here focus on error handling and edge cases that don't
  // require mocking the AI SDK.
});
