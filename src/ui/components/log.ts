import * as p from "@clack/prompts";
import { formatText } from "../utils/colors";

/**
 * Log utilities for consistent CLI output
 *
 * Uses @clack/prompts log functions for styled output
 */
export const log = {
  /**
   * Display an info message
   *
   * @example
   * ```typescript
   * log.info("Processing files...");
   * ```
   */
  info(message: string): void {
    p.log.info(message);
  },

  /**
   * Display a success message
   *
   * @example
   * ```typescript
   * log.success("Build completed successfully!");
   * ```
   */
  success(message: string): void {
    p.log.success(message);
  },

  /**
   * Display a step message
   *
   * @example
   * ```typescript
   * log.step("Installing dependencies");
   * ```
   */
  step(message: string): void {
    p.log.step(message);
  },

  /**
   * Display a warning message
   *
   * @example
   * ```typescript
   * log.warn("Config file not found, using defaults");
   * ```
   */
  warn(message: string): void {
    p.log.warn(message);
  },

  /**
   * Display a general message
   *
   * @example
   * ```typescript
   * log.message("Welcome to the CLI!");
   * ```
   */
  message(message: string): void {
    p.log.message(message);
  },
};

/**
 * Output a result to the console
 *
 * @param result - The result to display (string, object, etc.)
 *
 * @example
 * ```typescript
 * output("Hello, world!");
 * output({ name: "John", age: 30 });
 * ```
 */
export function output(result: unknown): void {
  if (result === undefined || result === null) {
    return;
  }

  if (typeof result === "string") {
    p.log.message(result);
  } else {
    p.log.message(JSON.stringify(result, null, 2));
  }
}

/**
 * Display an error message with optional suggestions
 *
 * @param message - Error message
 * @param suggestions - Optional suggestions for fixing the error
 *
 * @example
 * ```typescript
 * error("Failed to load config", [
 *   "Check if config.json exists",
 *   "Verify JSON syntax"
 * ]);
 * ```
 */
export function error(message: string, suggestions?: string[]): void {
  p.log.error(message);

  if (suggestions?.length) {
    p.log.message("");
    p.log.message(formatText("Suggestions:", { dim: true }));
    for (const suggestion of suggestions) {
      p.log.message(`  ${formatText("•", { dim: true })} ${suggestion}`);
    }
  }
}

/**
 * Display help text
 *
 * @param content - Help text content
 *
 * @example
 * ```typescript
 * help("Usage: myapp <command> [options]");
 * ```
 */
export function help(content: string): void {
  p.log.message(content);
}
