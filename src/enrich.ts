import type { IndexDatabase } from "./database";
import { getFileHistory } from "./git";
import type { EnrichedErrorStack, EnrichedFrame, ErrorFrame } from "./types";

/**
 * Enrich error stack frames with file descriptions, dependencies, and git history.
 *
 * For each frame, looks up the file in the kly index and augments it with:
 * - File description, summary, symbols, language (from index)
 * - importedBy / importsFrom (from dependencies table)
 * - Recent git commits (from git log)
 *
 * Frames whose files are not in the index are included with empty/default values.
 */
export function enrichErrorStack(
  db: IndexDatabase,
  root: string,
  frames: ErrorFrame[],
): EnrichedErrorStack {
  const allImportedBy = new Set<string>();
  const enrichedFrames: EnrichedFrame[] = [];

  for (const frame of frames) {
    const fileIndex = db.getFile(frame.file);
    const importedBy = db.getDependents(frame.file);
    const importsFrom = db.getDependencies(frame.file);
    const commits = getFileHistory(root, frame.file, 5);

    for (const dep of importedBy) {
      allImportedBy.add(dep);
    }

    enrichedFrames.push({
      file: frame.file,
      line: frame.line,
      column: frame.column,
      function: frame.function,
      fileDescription: fileIndex?.description ?? "",
      fileSummary: fileIndex?.summary ?? "",
      symbols: fileIndex?.symbols ?? [],
      language: fileIndex?.language ?? "typescript",
      importedBy,
      importsFrom,
      lastModified: commits[0] ?? null,
      recentCommits: commits,
    });
  }

  return {
    frames: enrichedFrames,
    affectedFiles: allImportedBy.size,
  };
}
