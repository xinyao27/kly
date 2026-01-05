import type { ModelConfig, ModelInfo, ModelsContext } from "../types";
import { getCurrentModelConfig, listModels } from "./storage";

/**
 * Create models context for ExecuteContext
 * Provides access to configured LLM models and their credentials
 */
export function createModelsContext(): ModelsContext {
  return {
    list(): ModelInfo[] {
      return listModels().map((m) => ({
        name: m.name,
        provider: m.config.provider,
        model: m.config.model,
        isCurrent: m.isCurrent,
      }));
    },

    getCurrent(): ModelInfo | null {
      const models = listModels();
      const current = models.find((m) => m.isCurrent);
      if (!current) return null;

      return {
        name: current.name,
        provider: current.config.provider,
        model: current.config.model,
        isCurrent: true,
      };
    },

    get(name: string): ModelInfo | null {
      const models = listModels();
      const found = models.find((m) => m.name === name);
      if (!found) return null;

      return {
        name: found.name,
        provider: found.config.provider,
        model: found.config.model,
        isCurrent: found.isCurrent,
      };
    },

    async getConfigAsync(name?: string): Promise<ModelConfig | null> {
      if (name) {
        const models = listModels();
        const found = models.find((m) => m.name === name);
        if (!found) return null;

        return {
          provider: found.config.provider,
          model: found.config.model,
          apiKey: found.config.apiKey,
          baseURL: found.config.baseURL,
        };
      }

      const current = getCurrentModelConfig();
      if (!current) return null;

      return {
        provider: current.provider,
        model: current.model,
        apiKey: current.apiKey,
        baseURL: current.baseURL,
      };
    },
  };
}
