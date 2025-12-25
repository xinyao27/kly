import * as p from "@clack/prompts";
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
  // Non-TTY fallback: return default or throw
  if (!isTTY()) {
    if (config.defaultValue !== undefined) {
      return config.defaultValue;
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
