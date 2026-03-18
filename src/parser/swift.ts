import Parser from "tree-sitter";
import Swift from "tree-sitter-swift";

import type { ParseResult, SymbolInfo, SymbolKind } from "../types";
import { BaseParser } from "./base";

const swiftParser = new Parser();
swiftParser.setLanguage(Swift);

const SYMBOL_NODE_TYPES: Record<string, SymbolKind> = {
  class_declaration: "class",
  protocol_declaration: "protocol",
  function_declaration: "function",
};

// tree-sitter-swift parses struct/enum/class all as class_declaration.
// Detect actual kind from the first keyword child.
const KEYWORD_TO_KIND: Record<string, SymbolKind> = {
  struct: "struct",
  enum: "enum",
  class: "class",
};

function extractName(node: Parser.SyntaxNode): string | null {
  /* v8 ignore next */
  return node.childForFieldName("name")?.text ?? null;
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
        /* v8 ignore next */
        if (children.length > 0) {
          imports.push(children.map((c: Parser.SyntaxNode) => c.text).join("."));
        }
      }

      // Symbols
      let kind = SYMBOL_NODE_TYPES[node.type];
      if (node.type === "class_declaration") {
        // Detect struct/enum/class from keyword child
        const keyword = node.children.find((c: Parser.SyntaxNode) => c.type in KEYWORD_TO_KIND);
        /* v8 ignore next */
        kind = keyword ? KEYWORD_TO_KIND[keyword.type] : "class";
      }
      if (kind) {
        const name = extractName(node);
        /* v8 ignore next */
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
