import * as p from "@clack/prompts";

import { buildIndex } from "../indexer";
import { ensureInitialized } from "./shared";

export async function runBuild(
  root: string,
  options: { full?: boolean; quiet?: boolean },
): Promise<void> {
  ensureInitialized(root);

  const s = options.quiet ? null : p.spinner();
  s?.start("Building index...");

  try {
    await buildIndex(root, {
      full: options.full,
      quiet: options.quiet,
      onProgress: (progress) => {
        if (s) {
          const pct =
            progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 100;
          let msg = `Indexing [${pct}%] ${progress.current || "..."}`;
          if (progress.skipped > 0) {
            msg += ` (${progress.skipped} unchanged)`;
          }
          s.message(msg);
        }
      },
    });
    s?.stop("Index built successfully");
  } catch (error) {
    s?.stop("Build failed");
    if (!options.quiet) {
      p.log.error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}
