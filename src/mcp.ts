import { getModel } from "@mariozechner/pi-ai";
import type { Api, Model, Provider } from "@mariozechner/pi-ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config";
import { searchFiles, searchFilesWithRerank } from "./query";
import { openDatabase } from "./store";

function registerTools(server: McpServer, root: string): void {
  server.registerTool(
    "search_files",
    {
      description: "Search indexed files by natural language description",
      inputSchema: {
        query: z.string().describe("Natural language search query"),
        limit: z.number().optional().default(10).describe("Maximum number of results"),
        rerank: z
          .boolean()
          .optional()
          .default(false)
          .describe("Use LLM to rerank results for better relevance"),
      },
    },
    async ({ query, limit, rerank }) => {
      const db = openDatabase(root);
      try {
        let results;
        if (rerank) {
          const config = loadConfig(root);
          const model = (getModel as (p: Provider, m: string) => Model<Api>)(
            config.llm.provider,
            config.llm.model,
          );
          const envKeyMap: Record<string, string> = {
            openrouter: "OPENROUTER_API_KEY",
            anthropic: "ANTHROPIC_API_KEY",
            openai: "OPENAI_API_KEY",
            google: "GOOGLE_API_KEY",
            mistral: "MISTRAL_API_KEY",
            groq: "GROQ_API_KEY",
            xai: "XAI_API_KEY",
          };
          const envKey =
            envKeyMap[config.llm.provider] || `${config.llm.provider.toUpperCase()}_API_KEY`;
          if (config.llm.apiKey && !process.env[envKey]) {
            process.env[envKey] = config.llm.apiKey;
          }
          results = await searchFilesWithRerank(db, model, query, limit);
        } else {
          results = searchFiles(db, query, limit);
        }

        const items = results.map((r) => ({
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
      } finally {
        db.close();
      }
    },
  );

  server.registerTool(
    "get_file_index",
    {
      description: "Get detailed index information for a specific file",
      inputSchema: {
        path: z.string().describe("File path relative to repository root"),
      },
    },
    async ({ path: filePath }) => {
      const db = openDatabase(root);
      try {
        const fileIndex = db.getFile(filePath);

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
      } finally {
        db.close();
      }
    },
  );

  server.registerTool(
    "get_overview",
    {
      description: "Get repository overview with file count and language breakdown",
    },
    async () => {
      const db = openDatabase(root);
      try {
        const totalFiles = db.getFileCount();
        const languages = db.getLanguageStats();
        const generatedAt = db.getMetadata("generated_at") || new Date().toISOString();
        const allFiles = db.getAllFiles();

        const overview = {
          totalFiles,
          generatedAt,
          languages,
          files: allFiles.map((f) => ({
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
      } finally {
        db.close();
      }
    },
  );
}

export async function startMcpServer(root: string): Promise<void> {
  const server = new McpServer({
    name: "kly",
    version: "0.1.0",
  });

  registerTools(server, root);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
