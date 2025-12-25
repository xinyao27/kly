import * as p from "@clack/prompts";
import { isTTY } from "../utils/tty";

/**
 * Simplified confirm function
 *
 * @example
 * ```typescript
 * const proceed = await confirm("Continue?", true);
 * ```
 */
export async function confirm(
  message: string,
  defaultValue = false,
): Promise<boolean> {
  if (!isTTY()) {
    // In MCP mode, warn about using default value for confirmation
    if (process.env.CLAI_MCP_MODE === "true") {
      console.warn(
        `[MCP Warning] Interactive confirmation not available. Using default value (${defaultValue}) for: ${message}`,
      );
    }
    return defaultValue;
  }

  const result = await p.confirm({
    message,
    initialValue: defaultValue,
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return result;
}
