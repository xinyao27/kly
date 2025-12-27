/**
 * Supported LLM providers
 */
export type LLMProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "ollama"
  | "groq"
  | "mistral"
  | "cohere"
  | "openai-compatible"; // For custom OpenAI-compatible endpoints

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string; // Optional for Ollama (local)
  baseURL?: string;
  model?: string;
}

/**
 * Default models for each provider
 * Based on https://models.dev/ (2025-12)
 */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini", // Fast, cheap ($0.15/$0.60 per 1M tokens)
  anthropic: "claude-3-5-sonnet-20241022", // Best balance ($3/$15 per 1M tokens)
  google: "gemini-2.5-flash", // Fast, cheap ($0.07/$0.30 per 1M tokens)
  deepseek: "deepseek-v3", // Cost-effective ($0.27/$0.41 per 1M tokens)
  ollama: "llama3.2", // Free, local
  groq: "llama-3.3-70b-versatile", // Ultra-fast inference
  mistral: "mistral-large-2411", // Latest Mistral
  cohere: "command-r-plus", // Enhanced reasoning
  "openai-compatible": "gpt-4o-mini", // Fallback
};
