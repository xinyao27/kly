import type { Api, Model } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import type { SearchResult } from "../../database";
import { parseRerankResponse, rerankResults } from "../../llm/reranker";

vi.mock("@mariozechner/pi-ai", () => ({
  complete: vi.fn(),
}));

function createMockResult(path: string): SearchResult {
  return {
    file: {
      path,
      name: path
        .split("/")
        .pop()!
        .replace(/\.\w+$/, ""),
      description: `Description of ${path}`,
      language: "typescript",
      imports: [],
      exports: [],
      symbols: [],
      summary: `Summary of ${path}`,
      hash: "abc",
      indexedAt: Date.now(),
    },
    score: Math.random(),
  };
}

describe("reranker", () => {
  describe("parseRerankResponse", () => {
    it("should parse a clean JSON array", () => {
      const response = '["src/a.ts", "src/b.ts", "src/c.ts"]';
      expect(parseRerankResponse(response)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    });

    it("should parse JSON array in markdown code block", () => {
      const response = '```json\n["src/a.ts", "src/b.ts"]\n```';
      expect(parseRerankResponse(response)).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("should parse JSON array in plain code block", () => {
      const response = '```\n["src/a.ts", "src/b.ts"]\n```';
      expect(parseRerankResponse(response)).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("should handle empty array", () => {
      const response = "[]";
      expect(parseRerankResponse(response)).toEqual([]);
    });

    it("should fallback to line-by-line extraction for non-JSON", () => {
      const response = `1. src/a.ts
2. src/b.ts
3. src/c.ts`;
      expect(parseRerankResponse(response)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    });

    it("should handle quoted paths in fallback mode", () => {
      const response = `"src/a.ts"
"src/b.ts"`;
      expect(parseRerankResponse(response)).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("should filter out non-path lines in fallback mode", () => {
      const response = `Here are the results:
src/a.ts
some random text
src/b.ts`;
      const result = parseRerankResponse(response);
      expect(result).toContain("src/a.ts");
      expect(result).toContain("src/b.ts");
      expect(result).not.toContain("some random text");
      expect(result).not.toContain("Here are the results:");
    });

    it("should handle single-item array", () => {
      const response = '["src/only.ts"]';
      expect(parseRerankResponse(response)).toEqual(["src/only.ts"]);
    });

    it("should handle paths with dots in names", () => {
      const response = '["src/config.test.ts", "src/utils.helper.js"]';
      expect(parseRerankResponse(response)).toEqual(["src/config.test.ts", "src/utils.helper.js"]);
    });
  });

  describe("rerankResults", () => {
    const mockModel = {} as Model<Api>;

    it("should return empty array for empty candidates", async () => {
      const result = await rerankResults(mockModel, "test", []);
      expect(result).toEqual([]);
    });

    it("should return single candidate without calling LLM", async () => {
      const candidates = [createMockResult("src/a.ts")];
      const result = await rerankResults(mockModel, "test", candidates, 10);
      expect(result).toHaveLength(1);
      expect(result[0].file.path).toBe("src/a.ts");
    });

    it("should reorder results based on LLM response", async () => {
      const { complete } = await import("@mariozechner/pi-ai");
      (complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [{ type: "text", text: '["src/b.ts", "src/a.ts", "src/c.ts"]' }],
      });

      const candidates = [
        createMockResult("src/a.ts"),
        createMockResult("src/b.ts"),
        createMockResult("src/c.ts"),
      ];

      const result = await rerankResults(mockModel, "test query", candidates, 10);
      expect(result).toHaveLength(3);
      expect(result[0].file.path).toBe("src/b.ts");
      expect(result[1].file.path).toBe("src/a.ts");
      expect(result[2].file.path).toBe("src/c.ts");
    });

    it("should respect topK limit", async () => {
      const { complete } = await import("@mariozechner/pi-ai");
      (complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [{ type: "text", text: '["src/b.ts", "src/a.ts", "src/c.ts"]' }],
      });

      const candidates = [
        createMockResult("src/a.ts"),
        createMockResult("src/b.ts"),
        createMockResult("src/c.ts"),
      ];

      const result = await rerankResults(mockModel, "test", candidates, 2);
      expect(result).toHaveLength(2);
    });

    it("should append missing candidates after LLM results", async () => {
      const { complete } = await import("@mariozechner/pi-ai");
      // LLM only returns 1 of 3 candidates
      (complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [{ type: "text", text: '["src/b.ts"]' }],
      });

      const candidates = [
        createMockResult("src/a.ts"),
        createMockResult("src/b.ts"),
        createMockResult("src/c.ts"),
      ];

      const result = await rerankResults(mockModel, "test", candidates, 10);
      expect(result).toHaveLength(3);
      expect(result[0].file.path).toBe("src/b.ts");
      // Remaining in original order
      expect(result[1].file.path).toBe("src/a.ts");
      expect(result[2].file.path).toBe("src/c.ts");
    });

    it("should handle duplicate paths from LLM gracefully", async () => {
      const { complete } = await import("@mariozechner/pi-ai");
      (complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [{ type: "text", text: '["src/a.ts", "src/a.ts", "src/b.ts"]' }],
      });

      const candidates = [createMockResult("src/a.ts"), createMockResult("src/b.ts")];

      const result = await rerankResults(mockModel, "test", candidates, 10);
      expect(result).toHaveLength(2);
      expect(result[0].file.path).toBe("src/a.ts");
      expect(result[1].file.path).toBe("src/b.ts");
    });
  });
});
