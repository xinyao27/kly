import Parser from "tree-sitter";
import Swift from "tree-sitter-swift";

import type { ParseResult, SymbolInfo, SymbolKind } from "../types.js";
import { BaseParser } from "./base.js";

const swiftParser = new Parser();
swiftParser.setLanguage(Swift);

const SYMBOL_NODE_TYPES: Record<string, SymbolKind> = {
  class_declaration: "class",
  struct_declaration: "struct",
  protocol_declaration: "protocol",
  function_declaration: "function",
  enum_declaration: "enum",
};

function extractName(node: Parser.SyntaxNode): string | null {
  const nameNode = node.childForFieldName("name");
  if (nameNode) return nameNode.text;

  // Fallback: look for type_identifier or simple_identifier
  for (const child of node.children) {
    if (child.type === "type_identifier" || child.type === "simple_identifier") {
      return child.text;
    }
  }

  return null;
}

export class SwiftParser extends BaseParser {
  readonly extensions = [".swift"];

  parse(content: string, _filePath: string): ParseResult {
    const tree = swiftParser.parse(content);
    const rootNode = tree.rootNode;

    const imports: string[] = [];
    const exports: string[] = [];
    const symbols: SymbolInfo[] = [];

    function walk(node: Parser.SyntaxNode): void {
      // Imports
      if (node.type === "import_declaration") {
        // Get the module name from import statement
        const children = node.children.filter((c: Parser.SyntaxNode) => c.type !== "import");
        if (children.length > 0) {
          imports.push(children.map((c: Parser.SyntaxNode) => c.text).join("."));
        }
      }

      // Symbols
      const kind = SYMBOL_NODE_TYPES[node.type];
      if (kind) {
        const name = extractName(node);
        if (name) {
          symbols.push({ name, kind, description: "" });
          // In Swift, all top-level declarations are effectively exported
          exports.push(name);
        }
      }

      for (const child of node.children) {
        walk(child);
      }
    }

    walk(rootNode);

    return { imports, exports, symbols };
  }
}
