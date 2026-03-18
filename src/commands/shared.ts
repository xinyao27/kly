import * as p from "@clack/prompts";

import { isInitialized } from "../config";

export function ensureInitialized(root: string): void {
  if (!isInitialized(root)) {
    p.log.error("Not initialized. Run `kly init` first.");
    process.exit(1);
  }
}
