import { openDatabase } from "../store";
import { type OutputOptions, output } from "./output";
import { ensureInitialized } from "./shared";

export interface OverviewOptions extends OutputOptions {}

function formatOverview(data: unknown): string {
  const overview = data as {
    totalFiles: number;
    languages: Record<string, number>;
    files: Array<{ path: string; name: string; description: string }>;
  };

  if (overview.totalFiles === 0) {
    return "no files indexed yet. run `kly build` first.";
  }

  const lines: string[] = [`total_files: ${overview.totalFiles}`, "", "languages:"];

  const sorted = Object.entries(overview.languages).sort(([, a], [, b]) => b - a);
  for (const [lang, count] of sorted) {
    const pct = ((count / overview.totalFiles) * 100).toFixed(1);
    lines.push(`  ${lang}: ${count} (${pct}%)`);
  }

  lines.push("", "files:");
  for (const file of overview.files) {
    lines.push(`  ${file.path}`);
    if (file.description) {
      lines.push(`    ${file.description}`);
    }
  }

  return lines.join("\n");
}

export function runOverview(root: string, options: OverviewOptions = {}): void {
  ensureInitialized(root);

  const db = openDatabase(root);
  try {
    const totalFiles = db.getFileCount();
    const languages = db.getLanguageStats();
    const allFiles = db.getAllFiles();

    const data = {
      totalFiles,
      languages,
      files: allFiles.map((f) => ({
        path: f.path,
        name: f.name,
        description: f.description,
      })),
    };

    output(data, options, formatOverview);
  } finally {
    db.close();
  }
}
