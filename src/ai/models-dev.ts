import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LLMProvider } from "./types";

const MODELS_DEV_API = "https://models.dev/api.json";
const CACHE_FILE = join(homedir(), ".clai", "models-cache.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Model data from models.dev
 */
export interface ModelInfo {
  id: string;
  name: string;
  family?: string;
  // Capabilities
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  // Pricing (per million tokens)
  cost?: {
    input?: number;
    output?: number;
    cache_write?: number;
    cache_read?: number;
  };
  // Limits
  limit?: {
    context?: number;
    output?: number;
  };
  // Metadata
  knowledge?: string;
  release?: string;
  release_date?: string;
  last_updated?: string;
  modalities?: {
    input?: string[];
    output?: string[];
  };
  open_weights?: boolean;
}

/**
 * Provider data from models.dev
 */
export interface ProviderInfo {
  id: string;
  name: string;
  api?: string;
  env?: string;
  npm?: string;
  doc?: string;
  models: Record<string, ModelInfo>;
}

/**
 * models.dev API response
 */
export interface ModelsDevData {
  providers: Record<string, ProviderInfo>;
  timestamp: number;
}

/**
 * Fetch models.dev data with caching
 */
export async function fetchModelsDevData(
  forceRefresh = false,
): Promise<ModelsDevData | null> {
  // Try to load from cache first
  if (!forceRefresh && existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
      const age = Date.now() - cached.timestamp;

      if (age < CACHE_TTL) {
        return cached;
      }
    } catch (_error) {
      // Cache file corrupted, continue to fetch
    }
  }

  // Fetch fresh data
  try {
    const response = await fetch(MODELS_DEV_API);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const cachedData: ModelsDevData = {
      providers: data,
      timestamp: Date.now(),
    };

    // Save to cache
    try {
      writeFileSync(CACHE_FILE, JSON.stringify(cachedData, null, 2), "utf-8");
    } catch (_error) {
      // Ignore cache write errors
    }

    return cachedData;
  } catch (_error) {
    // Network error, try to return stale cache
    if (existsSync(CACHE_FILE)) {
      try {
        return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
      } catch {
        // Ignore
      }
    }
    return null;
  }
}

/**
 * Map our provider IDs to models.dev IDs
 */
const PROVIDER_ID_MAP: Partial<Record<LLMProvider, string>> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  deepseek: "deepseek",
  groq: "groq",
  mistral: "mistral",
  cohere: "cohere",
  ollama: "ollama",
};

/**
 * Get provider info by our internal provider ID
 */
export function getProviderInfo(
  data: ModelsDevData,
  provider: LLMProvider,
): ProviderInfo | null {
  const modelsDevId = PROVIDER_ID_MAP[provider];
  if (!modelsDevId) return null;

  return data.providers[modelsDevId] || null;
}

/**
 * Get all models for a provider
 */
export function getProviderModels(
  data: ModelsDevData,
  provider: LLMProvider,
): ModelInfo[] {
  const providerInfo = getProviderInfo(data, provider);
  if (!providerInfo) return [];

  return Object.values(providerInfo.models);
}

/**
 * Get model info by ID
 */
export function getModelInfo(
  data: ModelsDevData,
  provider: LLMProvider,
  modelId: string,
): ModelInfo | null {
  const providerInfo = getProviderInfo(data, provider);
  if (!providerInfo) return null;

  return providerInfo.models[modelId] || null;
}

/**
 * Format price for display
 */
export function formatPrice(pricePerMillion: number | undefined): string {
  if (pricePerMillion === undefined) return "N/A";
  if (pricePerMillion === 0) return "Free";

  // Format to 2 decimal places, remove trailing zeros and decimal point
  return pricePerMillion.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Format capabilities for display
 */
export function formatCapabilities(model: ModelInfo): string[] {
  const caps: string[] = [];

  if (model.tool_call) caps.push("Tools");
  if (model.reasoning) caps.push("Reasoning");
  if (model.structured_output) caps.push("JSON");
  if (model.attachment) caps.push("Files");

  return caps;
}

/**
 * Get logo URL for a provider
 */
export function getProviderLogoURL(provider: LLMProvider): string {
  const modelsDevId = PROVIDER_ID_MAP[provider];
  if (!modelsDevId) return "";

  return `https://models.dev/logos/${modelsDevId}.svg`;
}
