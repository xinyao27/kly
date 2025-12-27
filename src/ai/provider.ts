import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getDefaultBaseURL } from "./provider-config";
import type { LLMConfig } from "./types";
import { DEFAULT_MODELS } from "./types";

/**
 * Create a unified language model instance from LLM configuration
 * Supports all major LLM providers via Vercel AI SDK
 */
export function createModel(config: LLMConfig): LanguageModel {
  const modelName = config.model || DEFAULT_MODELS[config.provider];

  switch (config.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: config.apiKey!,
        baseURL: config.baseURL,
      });
      return openai(modelName);
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: config.apiKey!,
        baseURL: config.baseURL,
      });
      return anthropic(modelName);
    }

    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey!,
        baseURL: config.baseURL,
      });
      return google(modelName);
    }

    case "deepseek": {
      const deepseek = createDeepSeek({
        apiKey: config.apiKey!,
        baseURL: config.baseURL,
      });
      return deepseek(modelName);
    }

    case "groq": {
      // Groq is OpenAI-compatible
      const groq = createOpenAI({
        apiKey: config.apiKey!,
        baseURL: config.baseURL || getDefaultBaseURL("groq"),
      });
      return groq(modelName);
    }

    case "mistral": {
      const mistral = createMistral({
        apiKey: config.apiKey!,
        baseURL: config.baseURL,
      });
      return mistral(modelName);
    }

    case "cohere": {
      // Cohere is OpenAI-compatible
      const cohere = createOpenAI({
        apiKey: config.apiKey!,
        baseURL: config.baseURL || getDefaultBaseURL("cohere"),
      });
      return cohere(modelName);
    }

    case "ollama": {
      // Ollama is OpenAI-compatible (local)
      const ollama = createOpenAI({
        apiKey: config.apiKey || "ollama", // Ollama doesn't need real API key
        baseURL: config.baseURL || getDefaultBaseURL("ollama"),
      });
      return ollama(modelName);
    }

    case "openai-compatible": {
      // Generic OpenAI-compatible endpoint
      const custom = createOpenAI({
        apiKey: config.apiKey!,
        baseURL: config.baseURL!,
      });
      return custom(modelName);
    }

    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

/**
 * Check if a model supports the temperature parameter
 * Some reasoning models (o1, o3) don't support temperature
 */
export function supportsTemperature(modelName: string): boolean {
  const noTempModels = ["o1", "o3", "gpt-5", "o1-mini", "o1-preview"];
  return !noTempModels.some((prefix) => modelName.includes(prefix));
}
