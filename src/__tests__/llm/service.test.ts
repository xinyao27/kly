import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock pi-ai before importing LLMService
vi.mock("@mariozechner/pi-ai", () => ({
  complete: vi.fn(),
  getModel: vi.fn(() => ({})),
}));

import { complete } from "@mariozechner/pi-ai";
import type { TextContent } from "@mariozechner/pi-ai";

import { LLMService } from "../../llm/index.js";

function mockComplete(text: string) {
  const response = {
    content: [{ type: "text", text } as TextContent],
  };
  (complete as ReturnType<typeof vi.fn>).mockResolvedValue(response);
}

describe("LLMService", () => {
  let service: LLMService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LLMService({
      llm: { provider: "openrouter", model: "test-model", apiKey: "test-key" },
      include: [],
      exclude: [],
    });
  });

  describe("indexFile", () => {
    it("should parse plain JSON response", async () => {
      mockComplete(
        JSON.stringify({
          name: "Auth Module",
          description: "Handles authentication",
          summary: "This module provides auth.",
          symbols: [{ name: "login", description: "Logs in a user" }],
        }),
      );

      const result = await service.indexFile("src/auth.ts", "code", []);
      expect(result.name).toBe("Auth Module");
      expect(result.description).toBe("Handles authentication");
      expect(result.summary).toBe("This module provides auth.");
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe("login");
    });

    it("should parse markdown-wrapped JSON response", async () => {
      mockComplete(
        '```json\n{"name":"Test","description":"desc","summary":"sum","symbols":[]}\n```',
      );

      const result = await service.indexFile("src/test.ts", "code", []);
      expect(result.name).toBe("Test");
      expect(result.description).toBe("desc");
    });

    it("should use defaults for missing fields", async () => {
      mockComplete(JSON.stringify({}));

      const result = await service.indexFile("src/empty.ts", "code", []);
      expect(result.name).toBe("");
      expect(result.description).toBe("");
      expect(result.summary).toBe("");
      expect(result.symbols).toEqual([]);
    });

    it("should handle non-array symbols", async () => {
      mockComplete(
        JSON.stringify({
          name: "Test",
          description: "desc",
          summary: "sum",
          symbols: "not an array",
        }),
      );

      const result = await service.indexFile("src/test.ts", "code", []);
      expect(result.symbols).toEqual([]);
    });

    it("should handle symbols without description", async () => {
      mockComplete(
        JSON.stringify({
          name: "Test",
          description: "desc",
          summary: "sum",
          symbols: [{ name: "foo" }],
        }),
      );

      const result = await service.indexFile("src/test.ts", "code", []);
      expect(result.symbols[0].name).toBe("foo");
      expect(result.symbols[0].description).toBe("");
    });

    it("should handle symbols with missing name", async () => {
      mockComplete(
        JSON.stringify({
          name: "Test",
          description: "desc",
          summary: "sum",
          symbols: [{ description: "orphan symbol" }],
        }),
      );

      const result = await service.indexFile("src/test.ts", "code", []);
      expect(result.symbols[0].name).toBe("");
      expect(result.symbols[0].description).toBe("orphan symbol");
    });
  });

  describe("constructor", () => {
    it("should handle unknown provider (fallback env key)", () => {
      // Should not throw for unknown provider
      const svc = new LLMService({
        llm: { provider: "custom-provider", model: "m", apiKey: "k" },
        include: [],
        exclude: [],
      });
      expect(svc).toBeDefined();
    });
  });

  describe("indexFiles", () => {
    it("should return a Map of results keyed by path", async () => {
      let callCount = 0;
      (complete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                name: `File ${callCount}`,
                description: "desc",
                summary: "sum",
                symbols: [],
              }),
            },
          ],
        };
      });

      const results = await service.indexFiles([
        { path: "src/a.ts", content: "code a", symbols: [] },
        { path: "src/b.ts", content: "code b", symbols: [] },
      ]);

      expect(results.size).toBe(2);
      expect(results.get("src/a.ts")).toBeDefined();
      expect(results.get("src/b.ts")).toBeDefined();
    });
  });
});
