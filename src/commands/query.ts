import * as p from "@clack/prompts";

import { isInitialized } from "../config.js";
import { searchFiles } from "../query.js";
import { loadStore } from "../store.js";

export function runQuery(root: string, description: string): void {
  if (!isInitialized(root)) {
    p.log.error("Not initialized. Run `kly init` first.");
    process.exit(1);
  }

  const store = loadStore(root);
  const results = searchFiles(store, description);

  if (results.length === 0) {
    p.log.warn("No matching files found.");
    return;
  }

  p.log.info(`Found ${results.length} matching file(s):\n`);

  for (const result of results.slice(0, 20)) {
    const { file, score } = result;
    const symbols = file.symbols.length > 0
      ? file.symbols.slice(0, 5).map((s) => s.name).join(", ")
      : "";

    p.log.message(
      `${file.path} (score: ${score})\n`
      + `  ${file.name}: ${file.description}\n`
      + (symbols ? `  symbols: ${symbols}` : ""),
    );
  }
}
