import { describe, expect, it } from "vitest";

import { TypeScriptParser } from "../../parser/typescript";

describe("TypeScriptParser", () => {
  const parser = new TypeScriptParser();

  describe("extensions", () => {
    it("should support .ts, .tsx, .js, .jsx", () => {
      expect(parser.supports("file.ts")).toBe(true);
      expect(parser.supports("file.tsx")).toBe(true);
      expect(parser.supports("file.js")).toBe(true);
      expect(parser.supports("file.jsx")).toBe(true);
      expect(parser.supports("file.swift")).toBe(false);
    });
  });

  describe("imports", () => {
    it("should extract named imports", () => {
      const result = parser.parse('import { foo, bar } from "module";', "test.ts");
      expect(result.imports).toEqual(["module"]);
    });

    it("should extract default imports", () => {
      const result = parser.parse('import React from "react";', "test.ts");
      expect(result.imports).toEqual(["react"]);
    });

    it("should extract namespace imports", () => {
      const result = parser.parse('import * as path from "node:path";', "test.ts");
      expect(result.imports).toEqual(["node:path"]);
    });

    it("should strip quotes from import sources", () => {
      const result = parser.parse("import fs from 'node:fs';", "test.ts");
      expect(result.imports).toEqual(["node:fs"]);
    });

    it("should handle multiple imports", () => {
      const code = `
import { a } from "mod-a";
import { b } from "mod-b";
      `;
      const result = parser.parse(code, "test.ts");
      expect(result.imports).toEqual(["mod-a", "mod-b"]);
    });
  });

  describe("exports", () => {
    it("should extract default export (named function)", () => {
      const result = parser.parse("export default function main() {}", "test.ts");
      // Named default exports extract the function name
      expect(result.exports).toContain("main");
    });

    it("should extract named export declarations", () => {
      const result = parser.parse("export function hello() {}", "test.ts");
      expect(result.exports).toContain("hello");
    });

    it("should extract export clause", () => {
      const code = `
const a = 1;
const b = 2;
export { a, b };
      `;
      const result = parser.parse(code, "test.ts");
      expect(result.exports).toContain("a");
      expect(result.exports).toContain("b");
    });
  });

  describe("symbols", () => {
    it("should extract class declarations", () => {
      const result = parser.parse("class MyClass {}", "test.ts");
      const cls = result.symbols.find((s) => s.name === "MyClass");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
    });

    it("should extract function declarations", () => {
      const result = parser.parse("function doStuff() {}", "test.ts");
      const fn = result.symbols.find((s) => s.name === "doStuff");
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe("function");
    });

    it("should extract methods from class body", () => {
      const code = `
class Svc {
  handle() {}
}
      `;
      const result = parser.parse(code, "test.ts");
      expect(result.symbols.some((s) => s.name === "handle" && s.kind === "method")).toBe(true);
    });

    it("should extract interface declarations", () => {
      const result = parser.parse("interface Config { key: string; }", "test.ts");
      const iface = result.symbols.find((s) => s.name === "Config");
      expect(iface).toBeDefined();
      expect(iface!.kind).toBe("interface");
    });

    it("should extract type alias declarations", () => {
      const result = parser.parse("type ID = string | number;", "test.ts");
      const t = result.symbols.find((s) => s.name === "ID");
      expect(t).toBeDefined();
      expect(t!.kind).toBe("type");
    });

    it("should extract enum declarations", () => {
      const result = parser.parse("enum Status { Active, Inactive }", "test.ts");
      const e = result.symbols.find((s) => s.name === "Status");
      expect(e).toBeDefined();
      expect(e!.kind).toBe("enum");
    });

    it("should extract variable declarations", () => {
      const result = parser.parse("const MAX_RETRIES = 3;", "test.ts");
      const v = result.symbols.find((s) => s.name === "MAX_RETRIES");
      expect(v).toBeDefined();
      expect(v!.kind).toBe("variable");
    });

    it("should extract exported declarations as both exports and symbols", () => {
      const result = parser.parse("export class Router {}", "test.ts");
      expect(result.exports).toContain("Router");
      expect(result.symbols.some((s) => s.name === "Router")).toBe(true);
    });
  });

  describe("TSX", () => {
    it("should parse TSX files correctly", () => {
      const code = `
import React from "react";

export function App() {
  return <div>Hello</div>;
}
      `;
      const result = parser.parse(code, "test.tsx");
      expect(result.imports).toEqual(["react"]);
      expect(result.exports).toContain("App");
    });
  });

  describe("JS/JSX (merged)", () => {
    it("should parse plain JavaScript", () => {
      const code = `
import { useState } from "react";

export function Counter() {
  return null;
}

const helper = () => {};
      `;
      const result = parser.parse(code, "test.js");
      expect(result.imports).toEqual(["react"]);
      expect(result.exports).toContain("Counter");
      expect(result.symbols.some((s) => s.name === "Counter")).toBe(true);
      expect(result.symbols.some((s) => s.name === "helper")).toBe(true);
    });

    it("should parse JSX files", () => {
      const code = `
import React from "react";

export default function App() {
  return <div>Hello</div>;
}
      `;
      const result = parser.parse(code, "test.jsx");
      expect(result.imports).toEqual(["react"]);
      // Named default exports extract the function name
      expect(result.exports).toContain("App");
    });

    it("should not error on files without interface/type nodes", () => {
      const code = `
class Animal {
  speak() {}
}

function greet(name) {
  return "Hello " + name;
}
      `;
      const result = parser.parse(code, "test.js");
      expect(result.symbols.some((s) => s.name === "Animal" && s.kind === "class")).toBe(true);
      expect(result.symbols.some((s) => s.name === "greet" && s.kind === "function")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty file without error", () => {
      const result = parser.parse("", "test.ts");
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
      expect(result.symbols).toEqual([]);
    });

    it("should extract variable from let/var declarations", () => {
      const result = parser.parse("let counter = 0;", "test.ts");
      const v = result.symbols.find((s) => s.name === "counter");
      expect(v).toBeDefined();
      expect(v!.kind).toBe("variable");
    });

    it("should handle export default anonymous class (no name extracted)", () => {
      const result = parser.parse("export default class {}", "test.ts");
      // Anonymous class - extractName returns null, so no export name is added
      // But the class is still recognized as a symbol attempt
      expect(result.exports).toEqual([]);
    });

    it("should handle export * re-export", () => {
      const result = parser.parse('export * from "other-module";', "test.ts");
      expect(result.exports).toEqual([]);
    });
  });
});
