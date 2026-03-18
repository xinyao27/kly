import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

import type { ParseResult, SymbolInfo, SymbolKind } from "../types.js";
import { BaseParser } from "./base.js";

const tsParser = new Parser();
tsParser.setLanguage(TypeScript.typescript);

const tsxParser = new Parser();
tsxParser.setLanguage(TypeScript.tsx);

const IMPORT_TYPES = new Set(["import_statement"]);
const EXPORT_NODE_TYPES = new Set(["export_statement", "export_default_declaration"]);

const SYMBOL_NODE_TYPES: Record<string, SymbolKind> = {
  class_declaration: "class",
  function_declaration: "function",
  method_definition: "method",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
  lexical_declaration: "variable",
  variable_declaration: "variable",
};

function extractName(node: Parser.SyntaxNode): string | null {
  const nameNode = node.childForFieldName("name");
  if (nameNode) return nameNode.text;

  // For variable declarations, look for the first declarator
  for (const child of node.children) {
    if (child.type === "variable_declarator") {
      const n = child.childForFieldName("name");
      if (n) return n.text;
    }
  }

  return null;
}

function extractImports(rootNode: Parser.SyntaxNode): string[] {
  const imports: string[] = [];

  for (const child of rootNode.children) {
    if (IMPORT_TYPES.has(child.type)) {
      const source = child.childForFieldName("source");
      if (source) {
        imports.push(source.text.replace(/['"]/g, ""));
      }
    }
  }

  return imports;
}

function extractExports(rootNode: Parser.SyntaxNode): string[] {
  const exports: string[] = [];

  for (const child of rootNode.children) {
    if (EXPORT_NODE_TYPES.has(child.type)) {
      // export default
      if (child.type === "export_default_declaration") {
        exports.push("default");
        continue;
      }

      // export { ... }
      const exportClause = child.children.find(
        (c: Parser.SyntaxNode) => c.type === "export_clause",
      );
      if (exportClause) {
        for (const specifier of exportClause.children) {
          if (specifier.type === "export_specifier") {
            const name = specifier.childForFieldName("name");
            if (name) exports.push(name.text);
          }
        }
        continue;
      }

      // export declaration (class, function, etc.)
      const declaration = child.childForFieldName("declaration");
      if (declaration) {
        const name = extractName(declaration);
        if (name) exports.push(name);
      }
    }
  }

  return exports;
}

function extractSymbols(rootNode: Parser.SyntaxNode): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  function walk(node: Parser.SyntaxNode): void {
    // Check if this is an exported declaration wrapper
    if (EXPORT_NODE_TYPES.has(node.type)) {
      const declaration = node.childForFieldName("declaration");
      if (declaration) {
        processSymbolNode(declaration);
      }
      return;
    }

    processSymbolNode(node);

    for (const child of node.children) {
      // Only go one level deep for top-level symbols, skip into class bodies for methods
      if (child.type === "class_body") {
        for (const member of child.children) {
          processSymbolNode(member);
        }
      }
    }
  }

  function processSymbolNode(node: Parser.SyntaxNode): void {
    const kind = SYMBOL_NODE_TYPES[node.type];
    if (!kind) return;

    const name = extractName(node);
    if (!name) return;

    symbols.push({
      name,
      kind,
      description: "",
    });
  }

  for (const child of rootNode.children) {
    walk(child);
  }

  return symbols;
}

export class TypeScriptParser extends BaseParser {
  readonly extensions = [".ts", ".tsx"];

  parse(content: string, filePath: string): ParseResult {
    const parser = filePath.endsWith(".tsx") ? tsxParser : tsParser;
    const tree = parser.parse(content);
    const rootNode = tree.rootNode;

    return {
      imports: extractImports(rootNode),
      exports: extractExports(rootNode),
      symbols: extractSymbols(rootNode),
    };
  }
}
