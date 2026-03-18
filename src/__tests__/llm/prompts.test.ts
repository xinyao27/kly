import { describe, expect, it } from "vitest";

import { buildIndexingPrompt, INDEXING_SYSTEM_PROMPT } from "../../llm/prompts";

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
});
