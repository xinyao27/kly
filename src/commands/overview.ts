import * as p from "@clack/prompts";

import { openDatabase } from "../store";
import { ensureInitialized } from "./shared";

export function runOverview(root: string): void {
  ensureInitialized(root);

  const db = openDatabase(root);
  try {
    const totalFiles = db.getFileCount();

    if (totalFiles === 0) {
      p.log.warn("No files indexed yet. Run `kly build` first.");
      return;
    }

    const languages = db.getLanguageStats();
    const allFiles = db.getAllFiles();

    // Language breakdown with percentages
    const langLines: string[] = [];
    const sortedLangs = Object.entries(languages).sort(([, a], [, b]) => b - a);
    for (const [lang, count] of sortedLangs) {
      const pct = ((count / totalFiles) * 100).toFixed(1);
      langLines.push(`  ${lang}: ${count} files (${pct}%)`);
    }

    const lines: string[] = [`Total files: ${totalFiles}`, "", "Languages:", ...langLines];

    // Group files by language
    const grouped = new Map<string, typeof allFiles>();
    for (const file of allFiles) {
      const group = grouped.get(file.language) || [];
      group.push(file);
      grouped.set(file.language, group);
    }

    for (const [lang] of sortedLangs) {
      const files = grouped.get(lang);
      if (!files) continue;
      lines.push("", `${lang}:`);
      for (const file of files) {
        lines.push(`  ${file.path}`);
        if (file.description) {
          lines.push(`    ${file.description}`);
        }
      }
    }

    p.note(lines.join("\n"), "Repository Overview");
  } finally {
    db.close();
  }
}
