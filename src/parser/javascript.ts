import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";

import type { ParseResult, SymbolInfo, SymbolKind } from "../types.js";
import { BaseParser } from "./base.js";

const jsParser = new Parser();
jsParser.setLanguage(JavaScript);

const SYMBOL_NODE_TYPES: Record<string, SymbolKind> = {
  class_declaration: "class",
  function_declaration: "function",
  method_definition: "method",
  lexical_declaration: "variable",
  variable_declaration: "variable",
};

function extractName(node: Parser.SyntaxNode): string | null {
  const nameNode = node.childForFieldName("name");
  if (nameNode) return nameNode.text;

  for (const child of node.children) {
    if (child.type === "variable_declarator") {
      const n = child.childForFieldName("name");
      if (n) return n.text;
    }
  }

  return null;
}

export class JavaScriptParser extends BaseParser {
  readonly extensions = [".js", ".jsx"];

  parse(content: string, _filePath: string): ParseResult {
    const tree = jsParser.parse(content);
    const rootNode = tree.rootNode;

    const imports: string[] = [];
    const exports: string[] = [];
    const symbols: SymbolInfo[] = [];

    for (const child of rootNode.children) {
      // Imports
      if (child.type === "import_statement") {
        const source = child.childForFieldName("source");
        if (source) {
          imports.push(source.text.replace(/['"]/g, ""));
        }
      }

      // Exports
      if (child.type === "export_statement" || child.type === "export_default_declaration") {
        if (child.type === "export_default_declaration") {
          exports.push("default");
        } else {
          const declaration = child.childForFieldName("declaration");
          if (declaration) {
            const name = extractName(declaration);
            if (name) exports.push(name);
          }

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
          }
        }
      }

      // Symbols
      const kind = SYMBOL_NODE_TYPES[child.type];
      if (kind) {
        const name = extractName(child);
        if (name) {
          symbols.push({ name, kind, description: "" });
        }
      }

      // Exported declarations
      if (child.type === "export_statement") {
        const declaration = child.childForFieldName("declaration");
        if (declaration) {
          const kind = SYMBOL_NODE_TYPES[declaration.type];
          if (kind) {
            const name = extractName(declaration);
            if (name) {
              symbols.push({ name, kind, description: "" });
            }
          }
        }
      }
    }

    return { imports, exports, symbols };
  }
}
