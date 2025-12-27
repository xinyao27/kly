import * as p from "@clack/prompts";
import { sendIPCRequest } from "../../sandbox/ipc-client";
import { isMCP, isSandbox } from "../../shared/runtime-mode";
import { isTTY } from "../utils/tty";

/**
 * Configuration for input component
 */
export interface InputConfig {
  /** Prompt message */
  prompt: string;
  /** Default value */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum input length */
  maxLength?: number;
}

/**
 * Prompt for text input
 *
 * @example
 * ```typescript
 * const name = await input({
 *   prompt: "What's your name?",
 *   defaultValue: "Anonymous"
 * });
 * ```
 */
export async function input(config: InputConfig): Promise<string> {
  // Sandbox mode: use IPC to request input from host
  if (isSandbox()) {
    return sendIPCRequest<string>("prompt:input", config);
  }

  // Non-TTY fallback: return default or throw
  if (!isTTY()) {
    if (config.defaultValue !== undefined) {
      return config.defaultValue;
    }

    // Provide MCP-specific error message
    if (isMCP()) {
      throw new Error(
        `Interactive input not available in MCP mode. All parameters must be defined in the tool's inputSchema. Missing parameter: ${config.prompt}`,
      );
    }

    throw new Error(
      "Interactive input not available in non-TTY mode. Please provide all required arguments.",
    );
  }

  const result = await p.text({
    message: config.prompt,
    defaultValue: config.defaultValue,
    placeholder: config.placeholder,
    validate: config.maxLength
      ? (value) => {
          if (value && value.length > config.maxLength!) {
            return `Input must be ${config.maxLength} characters or less`;
          }
          return undefined;
        }
      : undefined,
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return result;
}
