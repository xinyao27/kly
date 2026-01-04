import * as p from "@clack/prompts";
import { handleCancel } from "../utils/cancel";
import { isTTY } from "../utils/tty";

/**
 * Option for autocomplete menus
 */
export interface AutocompleteOption<T = string> {
  /** Display name */
  name: string;
  /** Optional description shown below name */
  description?: string;
  /** Value returned when selected */
  value: T;
}

/**
 * Configuration for autocomplete component
 */
export interface AutocompleteConfig<T> {
  /** Options to choose from */
  options: AutocompleteOption<T>[];
  /** Prompt message */
  prompt?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum options to display (default: 10) */
  maxItems?: number;
}

/**
 * Show an autocomplete search menu
 *
 * @example
 * ```typescript
 * const country = await autocomplete({
 *   options: [
 *     { name: "United States", value: "us" },
 *     { name: "United Kingdom", value: "uk" },
 *     { name: "Germany", value: "de" },
 *   ],
 *   prompt: "Search for a country"
 * });
 * ```
 */
export async function autocomplete<T = string>(config: AutocompleteConfig<T>): Promise<T> {
  // Non-TTY fallback: return first option
  if (!isTTY()) {
    const firstOption = config.options[0];
    if (!firstOption) {
      throw new Error("No options provided");
    }
    return firstOption.value;
  }

  const mappedOptions = config.options.map((opt) => ({
    label: opt.name,
    value: opt.value as unknown,
    ...(opt.description && { hint: opt.description }),
  }));

  const result = await p.autocomplete({
    message: config.prompt ?? "Search and select",
    options: mappedOptions,
    placeholder: config.placeholder,
    maxItems: config.maxItems ?? 10,
  });

  return handleCancel(result) as T;
}
