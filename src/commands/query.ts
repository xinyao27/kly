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

const MAX_RESULTS = 10;
const MAX_SUMMARY_LENGTH = 120;
const MAX_SYMBOLS = 5;

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatSymbols(result: SearchResult): string {
  const symbolNames = result.file.symbols.slice(0, MAX_SYMBOLS).map((symbol) => symbol.name);
  if (symbolNames.length === 0) {
    return "";
  }

  const remaining = result.file.symbols.length - symbolNames.length;
  return remaining > 0 ? `${symbolNames.join(", ")} (+${remaining} more)` : symbolNames.join(", ");
}

function displayResults(results: SearchResult[]): void {
  if (results.length === 0) {
    p.log.warn("No matching files found.");
    return;
  }

  p.log.info(`Found ${results.length} matching file(s).`);

  for (const [index, result] of results.entries()) {
    const { file, score } = result;
    const summary = truncateText(file.summary, MAX_SUMMARY_LENGTH);
    const symbols = formatSymbols(result);
    const lines = [
      `${index + 1}. ${file.path}`,
      `   ${file.name}`,
      `   ${file.description}`,
      `   Score: ${score.toFixed(2)}`,
    ];

    if (summary) {
      lines.push(`   Summary: ${summary}`);
    }

    if (symbols) {
      lines.push(`   Symbols: ${symbols}`);
    }

    p.log.message(lines.join("\n"));
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
      const results = await searchFilesWithRerank(db, model, description, MAX_RESULTS);
      displayResults(results);
    } else {
      const results = searchFiles(db, description, MAX_RESULTS);
      displayResults(results);
    }
  } finally {
    db.close();
  }
}
