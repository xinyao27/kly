import type { ModelConfigResponse } from "../shared/ipc-protocol";
import type { ModelConfig, ModelInfo, ModelsContext } from "../types";
import { sendIPCRequest } from "./executor";

/**
 * Create sandboxed models context that communicates with host via IPC
 * This context is injected into user tools running in the sandbox
 * All API key access is controlled by the host process
 */
export function createSandboxedModelsContext(): ModelsContext {
  return {
    /**
     * List available models (no permission required)
     */
    list(): ModelInfo[] {
      throw new Error(
        "Synchronous list() not supported in sandbox. Use async methods or move this logic to host.",
      );
    },

    /**
     * Get current model info (no permission required)
     */
    getCurrent(): ModelInfo | null {
      throw new Error(
        "Synchronous getCurrent() not supported in sandbox. Use async methods or move this logic to host.",
      );
    },

    /**
     * Get model info by name (no permission required)
     */
    get(_name: string): ModelInfo | null {
      throw new Error(
        "Synchronous get() not supported in sandbox. Use async methods or move this logic to host.",
      );
    },

    /**
     * Get model config with API key (requires permission, enforced by host)
     */
    async getConfigAsync(name?: string): Promise<ModelConfig | null> {
      try {
        const response = await sendIPCRequest<ModelConfigResponse | null>(
          "getModelConfig",
          { name },
        );

        if (!response) {
          return null;
        }

        return {
          provider: response.provider,
          model: response.model,
          apiKey: response.apiKey,
          baseURL: response.baseURL,
        };
      } catch (error) {
        // Re-throw with clear error message
        const message =
          error instanceof Error ? error.message : "Failed to get model config";
        throw new Error(`Permission denied: ${message}`);
      }
    },
  };
}

/**
 * Get the sandboxed context from global scope
 * This is injected by the executor before loading user scripts
 */
export function getSandboxedContext(): {
  modelsContext: ModelsContext;
} {
  const globalWithContext = global as {
    __KLY_SANDBOXED_CONTEXT__?: {
      modelsContext: ModelsContext;
    };
  };

  if (!globalWithContext.__KLY_SANDBOXED_CONTEXT__) {
    throw new Error(
      "Sandboxed context not available. This should only be called from within the sandbox.",
    );
  }

  return globalWithContext.__KLY_SANDBOXED_CONTEXT__;
}
