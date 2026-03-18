import * as p from "@clack/prompts";

import { isInitialized } from "../config";
import { searchFiles } from "../query";
import { openDatabase } from "../store";

export function runQuery(root: string, description: string): void {
  if (!isInitialized(root)) {
    p.log.error("Not initialized. Run `kly init` first.");
    process.exit(1);
  }

  const db = openDatabase(root);
  try {
    const results = searchFiles(db, description);

    if (results.length === 0) {
      p.log.warn("No matching files found.");
      return;
    }

    p.log.info(`Found ${results.length} matching file(s):\n`);

    for (const result of results.slice(0, 20)) {
      const { file, score } = result;
      const symbols =
        file.symbols.length > 0
          ? file.symbols
              .slice(0, 5)
              .map((s) => s.name)
              .join(", ")
          : "";

      p.log.message(
        `${file.path} (score: ${score.toFixed(2)})\n` +
          `  ${file.name}: ${file.description}\n` +
          (symbols ? `  symbols: ${symbols}` : ""),
      );
    }
  } finally {
    db.close();
  }
}
