import type { LLMConfig } from "./types";

/**
 * Detect LLM configuration from environment variables
 *
 * Priority order:
 * 1. OPENAI_API_KEY -> OpenAI
 * 2. ANTHROPIC_API_KEY -> Anthropic
 *
 * @returns LLM configuration or null if no API key found
 */
export function detectLLMConfig(): LLMConfig | null {
  // Check OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseURL: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL,
    };
  }

  // Check Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      baseURL: process.env.ANTHROPIC_BASE_URL,
      model: process.env.ANTHROPIC_MODEL,
    };
  }

  return null;
}

/**
 * Get user-friendly error message when no LLM is configured
 */
export function getNoLLMConfiguredMessage(): string {
  return `Natural language mode requires an LLM API key.

Set one of the following environment variables:
  export OPENAI_API_KEY=sk-...
  export ANTHROPIC_API_KEY=sk-ant-...

Or use explicit parameters instead:
  clai run <app> --param=value`;
}
