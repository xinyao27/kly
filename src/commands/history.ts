import { getFileHistory } from "../git";
import { type OutputOptions, output } from "./output";
import { ensureInitialized } from "./shared";

export interface HistoryOptions extends OutputOptions {
  limit?: number;
}

function formatHistory(data: unknown): string {
  const result = data as {
    file: string;
    commits: Array<{
      hash: string;
      author: string;
      date: number;
      message: string;
    }>;
  };

  if (result.commits.length === 0) {
    return `no git history found for ${result.file}`;
  }

  const lines: string[] = [];

  for (const c of result.commits) {
    const date = new Date(c.date * 1000).toISOString().slice(0, 10);
    lines.push(`${c.hash.slice(0, 7)} @${c.author} ${date} ${c.message}`);
  }

  return lines.join("\n");
}

export function runHistory(
  root: string,
  filePath: string,
  options: HistoryOptions = {},
): void {
  ensureInitialized(root);

  const limit = options.limit ?? 5;
  const commits = getFileHistory(root, filePath, limit);

  const data = { file: filePath, commits };
  output(data, options, formatHistory);
}
