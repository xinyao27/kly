import * as p from "@clack/prompts";
import { isTTY } from "../utils/tty";

/**
 * Option for select menus
 */
export interface SelectOption<T = string> {
  /** Display name */
  name: string;
  /** Optional description shown below name */
  description?: string;
  /** Value returned when selected */
  value: T;
  /** Disable this option */
  disabled?: boolean;
}

/**
 * Configuration for select component
 */
export interface SelectConfig<T> {
  /** Options to choose from */
  options: SelectOption<T>[];
  /** Prompt message */
  prompt?: string;
}

/**
 * Show a selection menu and wait for user choice
 *
 * @example
 * ```typescript
 * const color = await select({
 *   options: [
 *     { name: "Red", value: "red" },
 *     { name: "Blue", value: "blue", description: "Ocean color" },
 *   ],
 *   prompt: "Pick a color"
 * });
 * ```
 */
export async function select<T = string>(config: SelectConfig<T>): Promise<T> {
  // Non-TTY fallback: auto-select first option or throw in MCP mode
  if (!isTTY()) {
    // In MCP mode, interactive selection is not allowed
    if (process.env.CLAI_MCP_MODE === "true") {
      throw new Error(
        `Interactive selection not available in MCP mode. All parameters must be defined in the tool's inputSchema. Selection prompt: ${config.prompt}`,
      );
    }

    const firstOption = config.options[0];
    if (!firstOption) {
      throw new Error("No options provided");
    }
    return firstOption.value;
  }

  // Map to @clack/prompts Option format
  // Using type assertion due to complex Option<T> conditional types
  const mappedOptions = config.options.map((opt) => ({
    label: opt.name,
    value: opt.value as unknown,
    ...(opt.description && { hint: opt.description }),
  }));

  const result = await p.select({
    message: config.prompt ?? "Select an option",
    options: mappedOptions,
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return result as T;
}
