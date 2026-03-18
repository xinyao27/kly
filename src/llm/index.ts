import { complete, getModel } from "@mariozechner/pi-ai";
import type { Api, Model, Provider, TextContent } from "@mariozechner/pi-ai";

import type { KlyConfig, SymbolInfo } from "../types";
import { Batcher } from "./batcher";
import { buildIndexingPrompt, INDEXING_SYSTEM_PROMPT } from "./prompts";

interface LLMIndexResult {
  name: string;
  description: string;
  summary: string;
  symbols: { name: string; description: string }[];
}

/**
 * Resolve a model by provider and model ID from user config.
 * pi-ai's getModel is generic over compile-time known providers/models,
 * but user config is dynamic. This wrapper bridges the gap.
 */
function resolveModel(provider: Provider, modelId: string): Model<Api> {
  const model = (getModel as (p: Provider, m: string) => Model<Api> | undefined)(provider, modelId);
  if (!model) {
    throw new Error(
      `Unknown model "${modelId}" for provider "${provider}". Check your .kly/config.yaml.`,
    );
  }
  return model;
}

export class LLMService {
  private model: Model<Api>;
  private batcher: Batcher<LLMIndexResult>;

  constructor(config: KlyConfig) {
    const envKey = this.getEnvKeyName(config.llm.provider);
    if (config.llm.apiKey && !process.env[envKey]) {
      process.env[envKey] = config.llm.apiKey;
    }

    this.model = resolveModel(config.llm.provider, config.llm.model);
    this.batcher = new Batcher(5);
  }

  private getEnvKeyName(provider: string): string {
    const map: Record<string, string> = {
      openrouter: "OPENROUTER_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      google: "GOOGLE_API_KEY",
      mistral: "MISTRAL_API_KEY",
      groq: "GROQ_API_KEY",
      xai: "XAI_API_KEY",
    };
    return map[provider] || `${provider.toUpperCase()}_API_KEY`;
  }

  async indexFile(
    filePath: string,
    content: string,
    symbols: SymbolInfo[],
  ): Promise<LLMIndexResult> {
    const prompt = buildIndexingPrompt(
      filePath,
      content,
      symbols.map((s) => ({ name: s.name, kind: s.kind })),
    );

    const response = await complete(this.model, {
      systemPrompt: INDEXING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: prompt,
          timestamp: Date.now(),
        },
      ],
    });

    const text = response.content
      .filter((block): block is TextContent => block.type === "text")
      .map((block) => block.text)
      .join("");

    return this.parseResponse(text);
  }

  async indexFiles(
    files: { path: string; content: string; symbols: SymbolInfo[] }[],
  ): Promise<Map<string, LLMIndexResult>> {
    const results = new Map<string, LLMIndexResult>();

    const tasks = files.map((file) => ({
      execute: async () => {
        const result = await this.indexFile(file.path, file.content, file.symbols);
        results.set(file.path, result);
        return result;
      },
    }));

    await this.batcher.run(tasks);
    return results;
  }

  private parseResponse(text: string): LLMIndexResult {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

    const parsed = JSON.parse(jsonStr) as LLMIndexResult;

    return {
      name: parsed.name || "",
      description: parsed.description || "",
      summary: parsed.summary || "",
      symbols: Array.isArray(parsed.symbols)
        ? parsed.symbols.map((s) => ({
            name: s.name || "",
            description: s.description || "",
          }))
        : [],
    };
  }
}
