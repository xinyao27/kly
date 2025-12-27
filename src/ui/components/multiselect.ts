import * as p from "@clack/prompts";
import { sendIPCRequest } from "../../sandbox/ipc-client";
import { isSandbox } from "../../shared/runtime-mode";
import { isTTY } from "../utils/tty";

/**
 * Option for multiselect menus
 */
export interface MultiSelectOption<T = string> {
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
 * Configuration for multiselect component
 */
export interface MultiSelectConfig<T> {
  /** Options to choose from */
  options: MultiSelectOption<T>[];
  /** Prompt message */
  prompt?: string;
  /** Initially selected values */
  initialValues?: T[];
  /** Require at least one selection */
  required?: boolean;
}

/**
 * Show a multi-selection menu and wait for user choices
 *
 * @example
 * ```typescript
 * const colors = await multiselect({
 *   options: [
 *     { name: "Red", value: "red" },
 *     { name: "Blue", value: "blue", description: "Ocean color" },
 *     { name: "Green", value: "green" },
 *   ],
 *   prompt: "Pick your favorite colors"
 * });
 * ```
 */
export async function multiselect<T = string>(
  config: MultiSelectConfig<T>,
): Promise<T[]> {
  // Sandbox mode: use IPC to request multiselect from host
  if (isSandbox()) {
    return sendIPCRequest<T[]>("prompt:multiselect", {
      prompt: config.prompt ?? "Select options",
      options: config.options,
      required: config.required,
    });
  }

  // Non-TTY fallback: return initial values or empty array
  if (!isTTY()) {
    return config.initialValues ?? [];
  }

  const mappedOptions = config.options.map((opt) => ({
    label: opt.name,
    value: opt.value as unknown,
    ...(opt.description && { hint: opt.description }),
  }));

  const result = await p.multiselect({
    message: config.prompt ?? "Select options",
    options: mappedOptions,
    initialValues: config.initialValues as unknown[],
    required: config.required,
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return result as T[];
}
