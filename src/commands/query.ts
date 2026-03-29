import { getModel } from "@mariozechner/pi-ai";
import type { Api, Model, Provider } from "@mariozechner/pi-ai";

import { loadConfig } from "../config";
import type { SearchResult } from "../database";
import { searchFiles, searchFilesWithRerank } from "../query";
import { openDatabase } from "../store";
import { type OutputOptions, info, output } from "./output";
import { ensureInitialized } from "./shared";

export interface QueryOptions extends OutputOptions {
  rerank?: boolean;
  limit?: number;
}

function formatResults(data: unknown): string {
  const results = data as Array<{
    path: string;
    name: string;
    description: string;
    score: number;
    summary: string;
    symbols: string[];
  }>;

  if (results.length === 0) {
    return "no matching files found";
  }

  const lines: string[] = [`found ${results.length} file(s)`, ""];

  for (const r of results) {
    lines.push(r.path);
    lines.push(`  name: ${r.name}`);
    lines.push(`  description: ${r.description}`);
    lines.push(`  score: ${r.score.toFixed(2)}`);
    if (r.summary) {
      const summary = r.summary.replace(/\s+/g, " ").trim();
      lines.push(`  summary: ${summary.length > 120 ? summary.slice(0, 117) + "..." : summary}`);
    }
    if (r.symbols.length > 0) {
      const shown = r.symbols.slice(0, 5);
      const more = r.symbols.length - shown.length;
      lines.push(`  symbols: ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function toOutputData(results: SearchResult[]) {
  return results.map((r) => ({
    path: r.file.path,
    name: r.file.name,
    description: r.file.description,
    score: r.score,
    summary: r.file.summary,
    language: r.file.language,
    symbols: r.file.symbols.map((s) => s.name),
  }));
}

export async function runQuery(
  root: string,
  description: string,
  options: QueryOptions = {},
): Promise<void> {
  ensureInitialized(root);

  const limit = options.limit ?? 10;
  const db = openDatabase(root);

  try {
    let results: SearchResult[];

    if (options.rerank) {
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

      if (options.pretty) {
        info("reranking results with LLM...");
      }
      results = await searchFilesWithRerank(db, model, description, limit);
    } else {
      results = searchFiles(db, description, limit);
    }

    const data = toOutputData(results);
    output(data, options, formatResults);
  } finally {
    db.close();
  }
}
