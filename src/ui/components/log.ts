import * as p from "@clack/prompts";

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
   * Display an error message
   *
   * @example
   * ```typescript
   * log.error("Failed to connect to database");
   * ```
   */
  error(message: string): void {
    p.log.error(message);
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
