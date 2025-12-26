/**
 * Supported LLM providers
 */
export type LLMProvider = "openai" | "anthropic";

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseURL?: string;
  model?: string;
}
