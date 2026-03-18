import { describe, expect, it } from "vitest";

import {
  buildIndexingPrompt,
  buildRerankPrompt,
  INDEXING_SYSTEM_PROMPT,
  RERANK_SYSTEM_PROMPT,
} from "../../llm/prompts";

describe("llm/prompts", () => {
  describe("INDEXING_SYSTEM_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(INDEXING_SYSTEM_PROMPT).toBeTruthy();
      expect(typeof INDEXING_SYSTEM_PROMPT).toBe("string");
    });

    it("should contain JSON instruction", () => {
      expect(INDEXING_SYSTEM_PROMPT).toContain("JSON");
    });
  });

  describe("buildIndexingPrompt", () => {
    it("should include file path", () => {
      const prompt = buildIndexingPrompt("src/auth.ts", "const x = 1;", []);
      expect(prompt).toContain("src/auth.ts");
    });

    it("should include source code", () => {
      const code = "export function hello() { return 'world'; }";
      const prompt = buildIndexingPrompt("src/hello.ts", code, []);
      expect(prompt).toContain(code);
    });

    it("should include symbol list", () => {
      const symbols = [
        { name: "MyClass", kind: "class" },
        { name: "doStuff", kind: "function" },
      ];
      const prompt = buildIndexingPrompt("src/a.ts", "code", symbols);
      expect(prompt).toContain("class: MyClass");
      expect(prompt).toContain("function: doStuff");
    });

    it("should handle empty symbols without error", () => {
      const prompt = buildIndexingPrompt("src/empty.ts", "// empty", []);
      expect(prompt).toContain("src/empty.ts");
    });
  });

  describe("RERANK_SYSTEM_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(RERANK_SYSTEM_PROMPT).toBeTruthy();
      expect(typeof RERANK_SYSTEM_PROMPT).toBe("string");
    });

    it("should mention JSON array", () => {
      expect(RERANK_SYSTEM_PROMPT).toContain("JSON array");
    });
  });

  describe("buildRerankPrompt", () => {
    it("should include user query", () => {
      const prompt = buildRerankPrompt("auth service", []);
      expect(prompt).toContain("auth service");
    });

    it("should include candidate file info", () => {
      const candidates = [
        { path: "src/auth.ts", name: "Auth", description: "Auth module", summary: "Handles auth" },
        { path: "src/db.ts", name: "DB", description: "Database", summary: "Manages DB" },
      ];
      const prompt = buildRerankPrompt("authentication", candidates);
      expect(prompt).toContain("src/auth.ts");
      expect(prompt).toContain("Auth module");
      expect(prompt).toContain("src/db.ts");
      expect(prompt).toContain("Manages DB");
    });

    it("should number candidates", () => {
      const candidates = [
        { path: "src/a.ts", name: "A", description: "desc a", summary: "sum a" },
        { path: "src/b.ts", name: "B", description: "desc b", summary: "sum b" },
      ];
      const prompt = buildRerankPrompt("test", candidates);
      expect(prompt).toContain("1. src/a.ts");
      expect(prompt).toContain("2. src/b.ts");
    });
  });
});
