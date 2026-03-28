import { openDatabase } from "../store";
import { type OutputOptions, error, output } from "./output";
import { ensureInitialized } from "./shared";

export interface ShowOptions extends OutputOptions {}

function formatFile(data: unknown): string {
  const file = data as {
    path: string;
    name: string;
    description: string;
    language: string;
    summary: string;
    imports: string[];
    exports: string[];
    symbols: Array<{ kind: string; name: string; description: string }>;
    hash: string;
    indexedAt: string;
  };

  const lines: string[] = [
    `path: ${file.path}`,
    `name: ${file.name}`,
    `language: ${file.language}`,
    `description: ${file.description}`,
  ];

  if (file.summary) {
    lines.push(`summary: ${file.summary}`);
  }

  if (file.imports.length > 0) {
    lines.push("", `imports (${file.imports.length}):`);
    for (const imp of file.imports) {
      lines.push(`  ${imp}`);
    }
  }

  if (file.exports.length > 0) {
    lines.push("", `exports (${file.exports.length}):`);
    for (const exp of file.exports) {
      lines.push(`  ${exp}`);
    }
  }

  if (file.symbols.length > 0) {
    lines.push("", `symbols (${file.symbols.length}):`);
    for (const s of file.symbols) {
      lines.push(`  ${s.kind} ${s.name}`);
      if (s.description) {
        lines.push(`    ${s.description}`);
      }
    }
  }

  lines.push("", `hash: ${file.hash}`, `indexed_at: ${file.indexedAt}`);

  return lines.join("\n");
}

export function runShow(root: string, filePath: string, options: ShowOptions = {}): void {
  ensureInitialized(root);

  const db = openDatabase(root);
  try {
    const fileIndex = db.getFile(filePath);

    if (!fileIndex) {
      error(`File not found in index: ${filePath}`, `kly query "${filePath.split("/").pop()}"`);
    }

    const data = {
      path: fileIndex.path,
      name: fileIndex.name,
      description: fileIndex.description,
      language: fileIndex.language,
      summary: fileIndex.summary,
      imports: fileIndex.imports,
      exports: fileIndex.exports,
      symbols: fileIndex.symbols,
      hash: fileIndex.hash,
      indexedAt: new Date(fileIndex.indexedAt).toISOString(),
    };

    output(data, options, formatFile);
  } finally {
    db.close();
  }
}
