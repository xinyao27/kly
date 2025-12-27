import type { LLMProvider } from "./types";

/**
 * Provider configuration
 * Data sourced from https://models.dev/api.json
 */
interface ProviderConfig {
  baseURL?: string;
  docURL?: string;
  description?: string;
}

/**
 * Provider configurations
 * Based on https://models.dev/api.json
 */
const PROVIDER_CONFIGS: Partial<Record<LLMProvider, ProviderConfig>> = {
  openai: {
    docURL: "https://platform.openai.com/docs",
    description: "OpenAI's GPT models",
  },
  anthropic: {
    docURL: "https://docs.anthropic.com",
    description: "Anthropic's Claude models",
  },
  google: {
    docURL: "https://ai.google.dev/docs",
    description: "Google's Gemini models",
  },
  deepseek: {
    docURL: "https://platform.deepseek.com/docs",
    description: "DeepSeek's AI models",
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    docURL: "https://console.groq.com/docs",
    description: "Ultra-fast LLM inference",
  },
  mistral: {
    docURL: "https://docs.mistral.ai",
    description: "Mistral AI models",
  },
  cohere: {
    baseURL: "https://api.cohere.ai/v1",
    docURL: "https://docs.cohere.com",
    description: "Cohere's language models",
  },
  ollama: {
    baseURL: "http://localhost:11434/v1",
    docURL: "https://ollama.ai",
    description: "Local AI models",
  },
};

/**
 * Get default base URL for a provider
 */
export function getDefaultBaseURL(provider: LLMProvider): string | undefined {
  return PROVIDER_CONFIGS[provider]?.baseURL;
}

/**
 * Get documentation URL for a provider
 */
export function getProviderDocURL(provider: LLMProvider): string | undefined {
  return PROVIDER_CONFIGS[provider]?.docURL;
}

/**
 * Get provider description
 */
export function getProviderDescription(
  provider: LLMProvider,
): string | undefined {
  return PROVIDER_CONFIGS[provider]?.description;
}
