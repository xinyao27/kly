import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { getCurrentModelConfig, listModels } from "../ai/storage";
import type {
  IPCRequest,
  IPCResponse,
  ModelConfigResponse,
  ModelInfoResponse,
} from "../shared/ipc-protocol";

export interface ResourceProviderOptions {
  appId: string;
  allowApiKey: boolean;
  sandboxConfig: SandboxRuntimeConfig;
}

/**
 * Resource Provider - Host-side IPC server
 * Handles resource requests from the sandboxed child process
 * Enforces permissions and provides controlled access to sensitive resources
 */
export class ResourceProvider {
  constructor(private options: ResourceProviderOptions) {}

  /**
   * Handle an IPC request from sandbox
   */
  async handle(request: IPCRequest): Promise<IPCResponse> {
    try {
      switch (request.type) {
        case "listModels":
          return this.handleListModels(request.id);

        case "getModelConfig":
          return this.handleGetModelConfig(request.id, request.payload.name);

        case "log":
          return this.handleLog(
            request.id,
            request.payload.level,
            request.payload.message,
          );

        case "prompt:input":
          return this.handlePromptInput(request.id, request.payload);

        case "prompt:select":
          return this.handlePromptSelect(request.id, request.payload);

        case "prompt:confirm":
          return this.handlePromptConfirm(request.id, request.payload);

        case "prompt:multiselect":
          return this.handlePromptMultiselect(request.id, request.payload);

        case "prompt:form":
          return this.handlePromptForm(request.id, request.payload);

        default: {
          const unknownRequest = request as { type: string; id: string };
          return {
            type: "response",
            id: unknownRequest.id,
            success: false,
            error: `Unknown request type: ${unknownRequest.type}`,
          };
        }
      }
    } catch (error) {
      return {
        type: "response",
        id: request.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle: List available models (no permission required)
   */
  private handleListModels(
    requestId: string,
  ): IPCResponse<ModelInfoResponse[]> {
    const models = listModels();
    const response: ModelInfoResponse[] = models.map((m) => ({
      name: m.name,
      provider: m.config.provider,
      model: m.config.model,
      isCurrent: m.isCurrent,
    }));

    return {
      type: "response",
      id: requestId,
      success: true,
      data: response,
    };
  }

  /**
   * Handle: Get model config with API key (requires permission)
   */
  private handleGetModelConfig(
    requestId: string,
    name?: string,
  ): IPCResponse<ModelConfigResponse | null> {
    // Check permission
    if (!this.options.allowApiKey) {
      return {
        type: "response",
        id: requestId,
        success: false,
        error: "Permission denied: API key access not allowed for this app",
      };
    }

    // Get model config
    let modelConfig: ModelConfigResponse | null = null;

    if (name) {
      const models = listModels();
      const found = models.find((m) => m.name === name);
      if (found) {
        modelConfig = {
          provider: found.config.provider,
          model: found.config.model,
          apiKey: found.config.apiKey,
          baseURL: found.config.baseURL,
        };
      }
    } else {
      const current = getCurrentModelConfig();
      if (current) {
        modelConfig = {
          provider: current.provider,
          model: current.model,
          apiKey: current.apiKey,
          baseURL: current.baseURL,
        };
      }
    }

    return {
      type: "response",
      id: requestId,
      success: true,
      data: modelConfig,
    };
  }

  /**
   * Handle: Log message (for debugging)
   */
  private handleLog(
    requestId: string,
    level: "info" | "warn" | "error",
    message: string,
  ): IPCResponse<void> {
    const prefix = `[Sandbox:${this.options.appId}]`;

    switch (level) {
      case "info":
        console.log(`${prefix} ${message}`);
        break;
      case "warn":
        console.warn(`${prefix} ${message}`);
        break;
      case "error":
        console.error(`${prefix} ${message}`);
        break;
    }

    return {
      type: "response",
      id: requestId,
      success: true,
      data: undefined,
    };
  }

  /**
   * Handle: Interactive input prompt
   */
  private async handlePromptInput(
    requestId: string,
    payload: {
      prompt: string;
      defaultValue?: string;
      placeholder?: string;
      maxLength?: number;
    },
  ): Promise<IPCResponse<string>> {
    const result = await p.text({
      message: payload.prompt,
      defaultValue: payload.defaultValue,
      placeholder: payload.placeholder,
      validate: payload.maxLength
        ? (value) => {
            if (value && value.length > payload.maxLength!) {
              return `Input must be ${payload.maxLength} characters or less`;
            }
            return undefined;
          }
        : undefined,
    });

    if (p.isCancel(result)) {
      return {
        type: "response",
        id: requestId,
        success: false,
        error: "Operation cancelled by user",
      };
    }

    return {
      type: "response",
      id: requestId,
      success: true,
      data: result,
    };
  }

  /**
   * Handle: Interactive select prompt
   */
  private async handlePromptSelect(
    requestId: string,
    payload: {
      prompt: string;
      options: Array<{
        name: string;
        description?: string;
        value: string;
      }>;
    },
  ): Promise<IPCResponse<string>> {
    const mappedOptions = payload.options.map((opt) => ({
      label: opt.name,
      value: opt.value as unknown,
      ...(opt.description && { hint: opt.description }),
    }));

    const result = await p.select({
      message: payload.prompt,
      options: mappedOptions,
    });

    if (p.isCancel(result)) {
      return {
        type: "response",
        id: requestId,
        success: false,
        error: "Operation cancelled by user",
      };
    }

    return {
      type: "response",
      id: requestId,
      success: true,
      data: result as string,
    };
  }

  /**
   * Handle: Interactive confirm prompt
   */
  private async handlePromptConfirm(
    requestId: string,
    payload: {
      message: string;
      defaultValue?: boolean;
    },
  ): Promise<IPCResponse<boolean>> {
    const result = await p.confirm({
      message: payload.message,
      initialValue: payload.defaultValue,
    });

    if (p.isCancel(result)) {
      return {
        type: "response",
        id: requestId,
        success: false,
        error: "Operation cancelled by user",
      };
    }

    return {
      type: "response",
      id: requestId,
      success: true,
      data: result,
    };
  }

  /**
   * Handle: Interactive multiselect prompt
   */
  private async handlePromptMultiselect(
    requestId: string,
    payload: {
      prompt: string;
      options: Array<{
        name: string;
        description?: string;
        value: string;
      }>;
      required?: boolean;
    },
  ): Promise<IPCResponse<string[]>> {
    const mappedOptions = payload.options.map((opt) => ({
      label: opt.name,
      value: opt.value as unknown,
      ...(opt.description && { hint: opt.description }),
    }));

    const result = await p.multiselect({
      message: payload.prompt,
      options: mappedOptions,
      required: payload.required,
    });

    if (p.isCancel(result)) {
      return {
        type: "response",
        id: requestId,
        success: false,
        error: "Operation cancelled by user",
      };
    }

    return {
      type: "response",
      id: requestId,
      success: true,
      data: result as string[],
    };
  }

  /**
   * Handle: Interactive form prompt
   */
  private async handlePromptForm(
    requestId: string,
    payload: {
      title?: string;
      fields: Array<{
        name: string;
        label: string;
        type: "string" | "number" | "boolean" | "enum";
        required?: boolean;
        defaultValue?: unknown;
        description?: string;
        enumValues?: string[];
      }>;
    },
  ): Promise<IPCResponse<Record<string, unknown>>> {
    const result: Record<string, unknown> = {};

    if (payload.title) {
      console.log(`\n${pc.bold(payload.title)}\n`);
    }

    for (const field of payload.fields) {
      const label = field.description
        ? `${field.label} (${field.description})`
        : field.label;

      if (field.type === "boolean") {
        const value = await p.confirm({
          message: label,
          initialValue: field.defaultValue as boolean | undefined,
        });

        if (p.isCancel(value)) {
          return {
            type: "response",
            id: requestId,
            success: false,
            error: "Operation cancelled by user",
          };
        }

        result[field.name] = value;
      } else if (field.type === "enum" && field.enumValues?.length) {
        const value = await p.select({
          message: label,
          options: field.enumValues.map((v) => ({
            label: v,
            value: v,
          })),
        });

        if (p.isCancel(value)) {
          return {
            type: "response",
            id: requestId,
            success: false,
            error: "Operation cancelled by user",
          };
        }

        result[field.name] = value;
      } else if (field.type === "number") {
        const strValue = await p.text({
          message: label,
          defaultValue: field.defaultValue?.toString(),
          validate: (value) => {
            if (value && Number.isNaN(Number.parseFloat(value))) {
              return "Please enter a valid number";
            }
            return undefined;
          },
        });

        if (p.isCancel(strValue)) {
          return {
            type: "response",
            id: requestId,
            success: false,
            error: "Operation cancelled by user",
          };
        }

        result[field.name] = Number.parseFloat(strValue);
      } else {
        const value = await p.text({
          message: label,
          defaultValue: field.defaultValue as string | undefined,
        });

        if (p.isCancel(value)) {
          return {
            type: "response",
            id: requestId,
            success: false,
            error: "Operation cancelled by user",
          };
        }

        result[field.name] = value;
      }
    }

    return {
      type: "response",
      id: requestId,
      success: true,
      data: result,
    };
  }
}

/**
 * Factory function to create a resource provider
 */
export function createResourceProvider(
  options: ResourceProviderOptions,
): ResourceProvider {
  return new ResourceProvider(options);
}
