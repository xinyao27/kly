import { buildIndex } from "../indexer";
import { info } from "./output";
import { ensureInitialized } from "./shared";

export interface BuildOptions {
  full?: boolean;
  quiet?: boolean;
}

export async function runBuild(root: string, options: BuildOptions = {}): Promise<void> {
  ensureInitialized(root);

  if (!options.quiet) {
    info("building index...");
  }

  try {
    const result = await buildIndex(root, {
      full: options.full,
      quiet: options.quiet,
      onProgress: (progress) => {
        if (!options.quiet) {
          const pct =
            progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 100;
          let msg = `indexing [${pct}%] ${progress.current || "..."}`;
          if (progress.skipped > 0) {
            msg += ` (${progress.skipped} unchanged)`;
          }
          // Write progress to stderr so it doesn't pollute stdout
          process.stderr.write(`\r${msg}`);
        }
      },
    });

    if (!options.quiet) {
      // Clear the progress line
      process.stderr.write("\r\x1b[K");

      const parts: string[] = [];
      if (result.newFiles > 0) parts.push(`${result.newFiles} new`);
      if (result.updatedFiles > 0) parts.push(`${result.updatedFiles} updated`);
      if (result.deletedFiles > 0) parts.push(`${result.deletedFiles} deleted`);
      if (result.unchangedFiles > 0) parts.push(`${result.unchangedFiles} unchanged`);

      const summary = parts.length > 0 ? parts.join(", ") : "no changes";
      const duration = (result.durationMs / 1000).toFixed(1);

      const lines = [`indexed ${result.totalFiles} files (${summary})`, `branch: ${result.branch}`];
      if (result.commit) {
        lines.push(`commit: ${result.commit.slice(0, 7)}`);
      }
      lines.push(`duration: ${duration}s`);

      process.stdout.write(lines.join("\n") + "\n");
    }
  } catch (err) {
    process.stderr.write(`\r\x1b[K`);
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
