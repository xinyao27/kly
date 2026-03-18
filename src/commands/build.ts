import * as p from "@clack/prompts";

import { isInitialized } from "../config.js";
import { buildIndex } from "../indexer.js";

export async function runBuild(root: string, options: { incremental?: boolean }): Promise<void> {
  if (!isInitialized(root)) {
    p.log.error("Not initialized. Run `kly init` first.");
    process.exit(1);
  }

  const s = p.spinner();
  s.start("Building index...");

  await buildIndex(root, {
    incremental: options.incremental,
    onProgress: (progress) => {
      const pct = Math.round((progress.completed / progress.total) * 100);
      let msg = `Indexing [${pct}%] ${progress.current || "..."}`;
      if (progress.skipped > 0) {
        msg += ` (${progress.skipped} unchanged)`;
      }
      s.message(msg);
    },
  });

  s.stop("Index built successfully");
}
