import * as p from "@clack/prompts";

/**
 * Handle cancel action for prompts
 * If the value is a cancel symbol, displays "Operation cancelled" and exits
 * Otherwise returns the value
 */
export function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }
  return value;
}
