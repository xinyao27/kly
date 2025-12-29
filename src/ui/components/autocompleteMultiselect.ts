import * as p from "@clack/prompts";
import { handleCancel } from "../utils/cancel";
import { isTTY } from "../utils/tty";
import type { AutocompleteOption } from "./autocomplete";

/**
 * Configuration for autocomplete multiselect component
 */
export interface AutocompleteMultiselectConfig<T> {
  /** Options to choose from */
  options: AutocompleteOption<T>[];
  /** Prompt message */
  prompt?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum options to display (default: 10) */
  maxItems?: number;
  /** Initially selected values */
  initialValues?: T[];
  /** Require at least one selection */
  required?: boolean;
}

/**
 * Show an autocomplete search menu with multi-selection
 *
 * @example
 * ```typescript
 * const countries = await autocompleteMultiselect({
 *   options: [
 *     { name: "United States", value: "us" },
 *     { name: "United Kingdom", value: "uk" },
 *     { name: "Germany", value: "de" },
 *     { name: "France", value: "fr" },
 *   ],
 *   prompt: "Search and select countries"
 * });
 * ```
 */
export async function autocompleteMultiselect<T = string>(
  config: AutocompleteMultiselectConfig<T>,
): Promise<T[]> {
  // Non-TTY fallback: return initial values or empty array
  if (!isTTY()) {
    return config.initialValues ?? [];
  }

  const mappedOptions = config.options.map((opt) => ({
    label: opt.name,
    value: opt.value as unknown,
    ...(opt.description && { hint: opt.description }),
  }));

  const result = await p.autocompleteMultiselect({
    message: config.prompt ?? "Search and select multiple",
    options: mappedOptions,
    placeholder: config.placeholder,
    maxItems: config.maxItems ?? 10,
    initialValues: config.initialValues as unknown[],
    required: config.required,
  });

  return handleCancel(result) as T[];
}
