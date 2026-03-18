import { globby } from "globby";

import type { KlyConfig } from "./types";

export async function scanFiles(root: string, config: KlyConfig): Promise<string[]> {
  const files = await globby(config.include, {
    cwd: root,
    ignore: config.exclude,
    gitignore: true,
    absolute: false,
  });

  return files.sort();
}
