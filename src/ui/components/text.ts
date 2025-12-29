import * as p from "@clack/prompts";
import { sendIPCRequest } from "../../sandbox/ipc-client";
import { isMCP, isSandbox } from "../../shared/runtime-mode";
import { handleCancel } from "../utils/cancel";
import { isTTY } from "../utils/tty";

/**
 * Configuration for text component (compatible with @clack/prompts text)
 */
export interface TextConfig {
  /** Prompt message */
  message: string;
  /** Default value */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Validation function */
  validate?: (value: string | undefined) => string | Error | undefined;
}

/**
 * Prompt for text input (compatible with @clack/prompts text API)
 *
 * @example
 * ```typescript
 * const name = await text({
 *   message: "What's your name?",
 *   defaultValue: "Anonymous",
 *   validate: (value) => {
 *     if (!value) return "Name is required";
 *   }
 * });
 * ```
 */
export async function text(config: TextConfig): Promise<string> {
  // Sandbox mode: use IPC to request input from host
  if (isSandbox()) {
    return sendIPCRequest<string>("prompt:input", {
      prompt: config.message,
      defaultValue: config.defaultValue,
      placeholder: config.placeholder,
    });
  }

  // Non-TTY fallback: return default or throw
  if (!isTTY()) {
    if (config.defaultValue !== undefined) {
      return config.defaultValue;
    }

    // Provide MCP-specific error message
    if (isMCP()) {
      throw new Error(
        `Interactive input not available in MCP mode. All parameters must be defined in the tool's inputSchema. Missing parameter: ${config.message}`,
      );
    }

    throw new Error(
      "Interactive input not available in non-TTY mode. Please provide all required arguments.",
    );
  }

  const result = await p.text({
    message: config.message,
    defaultValue: config.defaultValue,
    placeholder: config.placeholder,
    validate: config.validate,
  });

  return handleCancel(result);
}
