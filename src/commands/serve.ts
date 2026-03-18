import * as p from "@clack/prompts";

import { startMcpServer } from "../mcp";
import { ensureInitialized } from "./shared";

export async function runServe(root: string): Promise<void> {
  ensureInitialized(root);

  p.log.info("Starting MCP server (stdio)...");
  await startMcpServer(root);
}
