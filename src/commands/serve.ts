import * as p from "@clack/prompts";

import { isInitialized } from "../config";
import { startMcpServer } from "../mcp";

export async function runServe(root: string): Promise<void> {
  if (!isInitialized(root)) {
    p.log.error("Not initialized. Run `kly init` first.");
    process.exit(1);
  }

  p.log.info("Starting MCP server (stdio)...");
  await startMcpServer(root);
}
