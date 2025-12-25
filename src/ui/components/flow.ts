import * as p from "@clack/prompts";

/**
 * Display an intro message at the start of your CLI
 *
 * @example
 * ```typescript
 * intro("Welcome to my-cli v1.0.0");
 * ```
 */
export function intro(message?: string): void {
  p.intro(message);
}

/**
 * Display an outro message at the end of your CLI
 *
 * @example
 * ```typescript
 * outro("Thanks for using my-cli!");
 * ```
 */
export function outro(message?: string): void {
  p.outro(message);
}

/**
 * Display a cancellation message and optionally exit
 *
 * @example
 * ```typescript
 * cancel("Operation cancelled");
 * ```
 */
export function cancel(message?: string): void {
  p.cancel(message);
}

/**
 * Check if a value is a cancel symbol
 *
 * @example
 * ```typescript
 * const result = await text({ message: "Enter name" });
 * if (isCancel(result)) {
 *   cancel("Cancelled");
 *   process.exit(0);
 * }
 * ```
 */
export function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

/**
 * Add a note/box with styled content
 *
 * @example
 * ```typescript
 * note("npm install my-package", "Next steps");
 * ```
 */
export function note(message: string, title?: string): void {
  p.note(message, title);
}
