import { describe, expect, it } from "vitest";

import { ParserManager } from "../../parser/index.js";

describe("ParserManager", () => {
  const manager = new ParserManager();

  describe("getParser", () => {
    it("should return TypeScriptParser for .ts", () => {
      expect(manager.getParser("file.ts")).toBeDefined();
    });

    it("should return TypeScriptParser for .tsx", () => {
      expect(manager.getParser("file.tsx")).toBeDefined();
    });

    it("should return TypeScriptParser for .js", () => {
      expect(manager.getParser("file.js")).toBeDefined();
    });

    it("should return TypeScriptParser for .jsx", () => {
      expect(manager.getParser("file.jsx")).toBeDefined();
    });

    it("should return SwiftParser for .swift", () => {
      expect(manager.getParser("file.swift")).toBeDefined();
    });

    it("should return undefined for unsupported extensions", () => {
      expect(manager.getParser("file.py")).toBeUndefined();
      expect(manager.getParser("file.rs")).toBeUndefined();
      expect(manager.getParser("file.go")).toBeUndefined();
    });
  });

  describe("getLanguage", () => {
    it("should return typescript for .ts/.tsx", () => {
      expect(manager.getLanguage("file.ts")).toBe("typescript");
      expect(manager.getLanguage("file.tsx")).toBe("typescript");
    });

    it("should return javascript for .js/.jsx", () => {
      expect(manager.getLanguage("file.js")).toBe("javascript");
      expect(manager.getLanguage("file.jsx")).toBe("javascript");
    });

    it("should return swift for .swift", () => {
      expect(manager.getLanguage("file.swift")).toBe("swift");
    });

    it("should return undefined for unsupported extensions", () => {
      expect(manager.getLanguage("file.py")).toBeUndefined();
    });
  });

  describe("parse", () => {
    it("should parse TypeScript file", () => {
      const result = manager.parse("export function hello() {}", "test.ts");
      expect(result).not.toBeNull();
      expect(result!.exports).toContain("hello");
    });

    it("should parse Swift file", () => {
      const result = manager.parse("class Foo {}", "test.swift");
      expect(result).not.toBeNull();
      expect(result!.symbols.some((s) => s.name === "Foo")).toBe(true);
    });

    it("should return null for unsupported file", () => {
      const result = manager.parse("print('hello')", "test.py");
      expect(result).toBeNull();
    });
  });
});
