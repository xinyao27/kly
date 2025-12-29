/**
 * Raw prompt utilities for scenarios that need manual cancel handling.
 * These are thin wrappers around @clack/prompts that don't auto-exit on cancel.
 * Use these when you need to return error responses instead of exiting (e.g., IPC handlers).
 */
import * as p from "@clack/prompts";

// Re-export isCancel for manual cancel detection
export const isCancel = p.isCancel;

/**
 * Raw text input - does NOT auto-exit on cancel
 * Returns the cancel symbol if user cancels, handle it manually
 */
export async function rawText(config: {
  message: string;
  defaultValue?: string;
  placeholder?: string;
  validate?: (value: string | undefined) => string | Error | undefined;
}): Promise<string | symbol> {
  return p.text(config);
}

/**
 * Raw select - does NOT auto-exit on cancel
 * Returns the cancel symbol if user cancels, handle it manually
 */
export async function rawSelect<T>(config: {
  message: string;
  options: Array<{
    label: string;
    value: T;
    hint?: string;
    disabled?: boolean;
  }>;
}): Promise<T | symbol> {
  // Use type assertion to handle clack's complex Option type
  return p.select({
    message: config.message,
    options: config.options as Parameters<typeof p.select>[0]["options"],
  }) as Promise<T | symbol>;
}

/**
 * Raw confirm - does NOT auto-exit on cancel
 * Returns the cancel symbol if user cancels, handle it manually
 */
export async function rawConfirm(config: {
  message: string;
  initialValue?: boolean;
}): Promise<boolean | symbol> {
  return p.confirm(config);
}

/**
 * Raw multiselect - does NOT auto-exit on cancel
 * Returns the cancel symbol if user cancels, handle it manually
 */
export async function rawMultiselect<T>(config: {
  message: string;
  options: Array<{
    label: string;
    value: T;
    hint?: string;
  }>;
  required?: boolean;
}): Promise<T[] | symbol> {
  // Use type assertion to handle clack's complex Option type
  return p.multiselect({
    message: config.message,
    options: config.options as Parameters<typeof p.multiselect>[0]["options"],
    required: config.required,
  }) as Promise<T[] | symbol>;
}

/**
 * Raw password input - does NOT auto-exit on cancel
 * Returns the cancel symbol if user cancels, handle it manually
 */
export async function rawPassword(config: {
  message: string;
  mask?: string;
  validate?: (value: string | undefined) => string | Error | undefined;
}): Promise<string | symbol> {
  return p.password(config);
}
