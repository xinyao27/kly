import * as p from "@clack/prompts";

import { isInitialized } from "../config";
import { buildIndex } from "../indexer";

export async function runBuild(
  root: string,
  options: { full?: boolean; quiet?: boolean },
): Promise<void> {
  if (!isInitialized(root)) {
    p.log.error("Not initialized. Run `kly init` first.");
    process.exit(1);
  }

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
