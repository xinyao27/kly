import { describe, expect, it } from "vitest";

import { SwiftParser } from "../../parser/swift";

describe("SwiftParser", () => {
  const parser = new SwiftParser();

  describe("extensions", () => {
    it("should support .swift", () => {
      expect(parser.supports("file.swift")).toBe(true);
      expect(parser.supports("file.ts")).toBe(false);
    });
  });

  describe("imports", () => {
    it("should extract import declarations", () => {
      const code = `
import Foundation
import UIKit
      `;
      const result = parser.parse(code, "test.swift");
      expect(result.imports).toContain("Foundation");
      expect(result.imports).toContain("UIKit");
    });
  });

  describe("symbols", () => {
    it("should extract class declarations", () => {
      const code = "class UserService {}";
      const result = parser.parse(code, "test.swift");
      const cls = result.symbols.find((s) => s.name === "UserService");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
    });

    it("should extract struct declarations", () => {
      const code = "struct Point { var x: Int; var y: Int }";
      const result = parser.parse(code, "test.swift");
      const s = result.symbols.find((s) => s.name === "Point");
      expect(s).toBeDefined();
      expect(s!.kind).toBe("struct");
    });

    it("should extract protocol declarations", () => {
      const code = "protocol Drawable { func draw() }";
      const result = parser.parse(code, "test.swift");
      const p = result.symbols.find((s) => s.name === "Drawable");
      expect(p).toBeDefined();
      expect(p!.kind).toBe("protocol");
    });

    it("should extract function declarations", () => {
      const code = "func greet(name: String) -> String { return name }";
      const result = parser.parse(code, "test.swift");
      const fn = result.symbols.find((s) => s.name === "greet");
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe("function");
    });

    it("should extract enum declarations", () => {
      const code = "enum Direction { case north, south, east, west }";
      const result = parser.parse(code, "test.swift");
      const e = result.symbols.find((s) => s.name === "Direction");
      expect(e).toBeDefined();
      expect(e!.kind).toBe("enum");
    });
  });

  describe("exports", () => {
    it("should treat all top-level declarations as exports", () => {
      const code = `
class Service {}
struct Config {}
func helper() {}
      `;
      const result = parser.parse(code, "test.swift");
      expect(result.exports).toContain("Service");
      expect(result.exports).toContain("Config");
      expect(result.exports).toContain("helper");
      // exports should match symbols
      expect(result.exports.length).toBe(result.symbols.length);
    });
  });

  describe("edge cases", () => {
    it("should handle empty file without error", () => {
      const result = parser.parse("", "test.swift");
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
      expect(result.symbols).toEqual([]);
    });
  });
});
