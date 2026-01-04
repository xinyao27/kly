import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import type { ModelConfig } from "../types";

/**
 * Message sent from Host to Sandbox on initialization
 */
export interface SandboxInitMessage {
  type: "init";
  scriptPath: string;
  args: string[];
  appId: string;
  /** Working directory where `kly run` was invoked */
  invokeDir: string;
  permissions: {
    allowApiKey: boolean;
    sandboxConfig: SandboxRuntimeConfig;
  };
}

/**
 * Request types sent from Sandbox to Host
 */
export type IPCRequest =
  | {
      type: "getModelConfig";
      id: string;
      payload: { name?: string };
    }
  | {
      type: "listModels";
      id: string;
      payload: Record<string, never>;
    }
  | {
      type: "log";
      id: string;
      payload: { level: "info" | "warn" | "error"; message: string };
    }
  | {
      type: "prompt:input";
      id: string;
      payload: {
        prompt: string;
        defaultValue?: string;
        placeholder?: string;
        maxLength?: number;
      };
    }
  | {
      type: "prompt:select";
      id: string;
      payload: {
        prompt: string;
        options: Array<{
          name: string;
          description?: string;
          value: string;
        }>;
      };
    }
  | {
      type: "prompt:confirm";
      id: string;
      payload: {
        message: string;
        defaultValue?: boolean;
      };
    }
  | {
      type: "prompt:multiselect";
      id: string;
      payload: {
        prompt: string;
        options: Array<{
          name: string;
          description?: string;
          value: string;
        }>;
        required?: boolean;
      };
    }
  | {
      type: "prompt:form";
      id: string;
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
      };
    };

/**
 * Response types sent from Host to Sandbox
 */
export type IPCResponse<T = unknown> =
  | {
      type: "response";
      id: string;
      success: true;
      data: T;
    }
  | {
      type: "response";
      id: string;
      success: false;
      error: string;
      /** True if this is a user cancellation, not an error */
      cancelled?: boolean;
    };

/**
 * Model info response (without sensitive data)
 */
export interface ModelInfoResponse {
  name: string;
  provider: string;
  model?: string;
  isCurrent: boolean;
}

/**
 * Model config response (with sensitive data like API keys)
 */
export interface ModelConfigResponse extends ModelConfig {
  provider: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
}

/**
 * Message sent from Sandbox to Host when execution completes
 */
export interface ExecutionCompleteMessage {
  type: "complete";
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Type guard for IPC messages
 */
export function isIPCRequest(msg: unknown): msg is IPCRequest {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    "id" in msg &&
    typeof msg.id === "string"
  );
}

export function isIPCResponse(msg: unknown): msg is IPCResponse {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    msg.type === "response" &&
    "id" in msg &&
    typeof msg.id === "string"
  );
}

export function isSandboxInitMessage(msg: unknown): msg is SandboxInitMessage {
  return typeof msg === "object" && msg !== null && "type" in msg && msg.type === "init";
}

export function isExecutionCompleteMessage(msg: unknown): msg is ExecutionCompleteMessage {
  return typeof msg === "object" && msg !== null && "type" in msg && msg.type === "complete";
}
