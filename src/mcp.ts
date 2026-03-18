import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadStore } from "./store.js";
import { getFileIndex } from "./store.js";
import { searchFiles } from "./query.js";

export async function startMcpServer(root: string): Promise<void> {
  const server = new McpServer({
    name: "kly",
    version: "0.1.0",
  });

  server.tool(
    "search_files",
    "Search indexed files by natural language description",
    {
      query: z.string().describe("Natural language search query"),
      limit: z.number().optional().default(10).describe("Maximum number of results"),
    },
    async ({ query, limit }) => {
      const store = loadStore(root);
      const results = searchFiles(store, query);

      const items = results.slice(0, limit).map((r) => ({
        path: r.file.path,
        name: r.file.name,
        description: r.file.description,
        language: r.file.language,
        score: r.score,
        symbols: r.file.symbols.map((s) => `${s.kind}: ${s.name}`),
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(items, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "get_file_index",
    "Get detailed index information for a specific file",
    {
      path: z.string().describe("File path relative to repository root"),
    },
    async ({ path: filePath }) => {
      const store = loadStore(root);
      const fileIndex = getFileIndex(store, filePath);

      if (!fileIndex) {
        return {
          content: [
            {
              type: "text" as const,
              text: `File not found in index: ${filePath}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(fileIndex, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "get_overview",
    "Get repository overview with file count and language breakdown",
    {},
    async () => {
      const store = loadStore(root);

      const languages: Record<string, number> = {};
      for (const file of store.files) {
        languages[file.language] = (languages[file.language] || 0) + 1;
      }

      const overview = {
        totalFiles: store.files.length,
        generatedAt: new Date(store.generatedAt).toISOString(),
        languages,
        files: store.files.map((f) => ({
          path: f.path,
          name: f.name,
          description: f.description,
        })),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(overview, null, 2),
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
