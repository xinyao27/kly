import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LLMConfig, LLMProvider } from "./types";

const CONFIG_DIR = join(homedir(), ".kly");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface KlyConfig {
  currentModel?: string;
  models: Record<string, LLMConfig>;
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load configuration from ~/.kly/config.json
 */
export function loadConfig(): KlyConfig {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return { models: {} };
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse config file:", error);
    return { models: {} };
  }
}

/**
 * Save configuration to ~/.kly/config.json
 */
export function saveConfig(config: KlyConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Get current active model configuration
 */
export function getCurrentModelConfig(): LLMConfig | null {
  const config = loadConfig();

  if (!config.currentModel) {
    return null;
  }

  return config.models[config.currentModel] || null;
}

/**
 * Set a model as current
 */
export function setCurrentModel(modelName: string): void {
  const config = loadConfig();

  if (!config.models[modelName]) {
    throw new Error(`Model '${modelName}' not found in config`);
  }

  config.currentModel = modelName;
  saveConfig(config);
}

/**
 * Add or update a model configuration
 */
export function saveModelConfig(
  modelName: string,
  modelConfig: LLMConfig,
): void {
  const config = loadConfig();

  config.models[modelName] = modelConfig;

  // Set as current if it's the first model
  if (!config.currentModel) {
    config.currentModel = modelName;
  }

  saveConfig(config);
}

/**
 * Remove a model configuration
 */
export function removeModelConfig(modelName: string): void {
  const config = loadConfig();

  delete config.models[modelName];

  // Clear current if it was removed
  if (config.currentModel === modelName) {
    config.currentModel = undefined;
  }

  saveConfig(config);
}

/**
 * List all configured models
 */
export function listModels(): Array<{
  name: string;
  config: LLMConfig;
  isCurrent: boolean;
}> {
  const config = loadConfig();

  return Object.entries(config.models).map(([name, modelConfig]) => ({
    name,
    config: modelConfig,
    isCurrent: name === config.currentModel,
  }));
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: LLMProvider): string {
  const displayNames: Record<LLMProvider, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    deepseek: "DeepSeek",
    ollama: "Ollama",
    groq: "Groq",
    mistral: "Mistral",
    cohere: "Cohere",
    "openai-compatible": "OpenAI Compatible",
  };
  return displayNames[provider];
}
