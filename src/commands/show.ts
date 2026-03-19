import * as p from "@clack/prompts";

import { openDatabase } from "../store";
import { ensureInitialized } from "./shared";

export function runShow(root: string, filePath: string): void {
  ensureInitialized(root);

  const db = openDatabase(root);
  try {
    const fileIndex = db.getFile(filePath);

    if (!fileIndex) {
      p.log.warn(`File not found in index: ${filePath}`);
      return;
    }

    const lines: string[] = [
      `Name: ${fileIndex.name}`,
      `Path: ${fileIndex.path}`,
      `Language: ${fileIndex.language}`,
      `Description: ${fileIndex.description}`,
      "",
      "Summary:",
      `  ${fileIndex.summary}`,
    ];

    if (fileIndex.imports.length > 0) {
      lines.push("", `Imports (${fileIndex.imports.length}):`);
      for (const imp of fileIndex.imports) {
        lines.push(`  - ${imp}`);
      }
    }

    if (fileIndex.exports.length > 0) {
      lines.push("", `Exports (${fileIndex.exports.length}):`);
      for (const exp of fileIndex.exports) {
        lines.push(`  - ${exp}`);
      }
    }

    if (fileIndex.symbols.length > 0) {
      lines.push("", `Symbols (${fileIndex.symbols.length}):`);
      for (const symbol of fileIndex.symbols) {
        lines.push(`  - ${symbol.kind} ${symbol.name}`);
        if (symbol.description) {
          lines.push(`    ${symbol.description}`);
        }
      }
    }

    lines.push("", `Hash: ${fileIndex.hash}`);
    lines.push(`Indexed: ${new Date(fileIndex.indexedAt).toISOString()}`);

    p.note(lines.join("\n"), `Indexed File: ${fileIndex.path}`);
  } finally {
    db.close();
  }
}
