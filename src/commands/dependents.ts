import { openDatabase } from "../store";
import { type OutputOptions, error, output } from "./output";
import { ensureInitialized } from "./shared";

export interface DependentsOptions extends OutputOptions {}

function formatDependents(data: unknown): string {
  const result = data as { file: string; dependents: string[] };

  if (result.dependents.length === 0) {
    return `${result.file} is not imported by any indexed file`;
  }

  const lines: string[] = [
    `${result.file} is imported by ${result.dependents.length} file(s)`,
    "",
  ];

  for (const dep of result.dependents) {
    lines.push(`  ${dep}`);
  }

  return lines.join("\n");
}

export function runDependents(
  root: string,
  filePath: string,
  options: DependentsOptions = {},
): void {
  ensureInitialized(root);

  const db = openDatabase(root);
  try {
    const fileIndex = db.getFile(filePath);
    if (!fileIndex) {
      error(
        `File not found in index: ${filePath}`,
        `kly query "${filePath.split("/").pop()}"`,
      );
    }

    const dependents = db.getDependents(filePath);
    const data = { file: filePath, dependents };

    output(data, options, formatDependents);
  } finally {
    db.close();
  }
}
