import * as p from "@clack/prompts";

import { isInitialized } from "../config.js";
import { getFileIndex, loadStore } from "../store.js";

export function runShow(root: string, filePath: string): void {
  if (!isInitialized(root)) {
    p.log.error("Not initialized. Run `kly init` first.");
    process.exit(1);
  }

  const store = loadStore(root);
  const fileIndex = getFileIndex(store, filePath);

  if (!fileIndex) {
    p.log.error(`File not found in index: ${filePath}`);
    return;
  }

  const lines: string[] = [
    `Path: ${fileIndex.path}`,
    `Name: ${fileIndex.name}`,
    `Language: ${fileIndex.language}`,
    `Description: ${fileIndex.description}`,
    "",
    "Summary:",
    `  ${fileIndex.summary}`,
  ];

  if (fileIndex.imports.length > 0) {
    lines.push("", "Imports:");
    for (const imp of fileIndex.imports) {
      lines.push(`  → ${imp}`);
    }
  }

  if (fileIndex.exports.length > 0) {
    lines.push("", "Exports:");
    for (const exp of fileIndex.exports) {
      lines.push(`  ← ${exp}`);
    }
  }

  if (fileIndex.symbols.length > 0) {
    lines.push("", "Symbols:");
    for (const symbol of fileIndex.symbols) {
      lines.push(`  ${symbol.kind} ${symbol.name}`);
      if (symbol.description) {
        lines.push(`    ${symbol.description}`);
      }
    }
  }

  lines.push("", `Hash: ${fileIndex.hash}`);
  lines.push(`Indexed: ${new Date(fileIndex.indexedAt).toISOString()}`);

  p.note(lines.join("\n"), fileIndex.path);
}
