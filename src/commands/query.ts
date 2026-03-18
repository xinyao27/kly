import * as p from "@clack/prompts";
import { getModel } from "@mariozechner/pi-ai";
import type { Api, Model, Provider } from "@mariozechner/pi-ai";

import { loadConfig } from "../config";
import type { SearchResult } from "../database";
import { searchFiles, searchFilesWithRerank } from "../query";
import { openDatabase } from "../store";
import { ensureInitialized } from "./shared";

export interface QueryOptions {
  rerank?: boolean;
}

function displayResults(results: SearchResult[]): void {
  if (results.length === 0) {
    p.log.warn("No matching files found.");
    return;
  }

  p.log.info(`Found ${results.length} matching file(s):\n`);

  for (const result of results) {
    const { file, score } = result;
    const symbols =
      file.symbols.length > 0
        ? file.symbols
            .slice(0, 5)
            .map((s) => s.name)
            .join(", ")
        : "";

    p.log.message(
      `${file.path} (score: ${score.toFixed(2)})\n` +
        `  ${file.name}: ${file.description}\n` +
        (symbols ? `  symbols: ${symbols}` : ""),
    );
  }
}

export async function runQuery(
  root: string,
  description: string,
  options: QueryOptions = {},
): Promise<void> {
  ensureInitialized(root);

  const db = openDatabase(root);
  try {
    if (options.rerank) {
      const config = loadConfig(root);
      const model = (getModel as (p: Provider, m: string) => Model<Api>)(
        config.llm.provider,
        config.llm.model,
      );

      // Set API key from config if not in env
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

      p.log.info("Reranking results with LLM...");
      const results = await searchFilesWithRerank(db, model, description);
      displayResults(results);
    } else {
      const results = searchFiles(db, description);
      displayResults(results.slice(0, 20));
    }
  } finally {
    db.close();
  }
}
