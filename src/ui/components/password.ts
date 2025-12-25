import * as p from "@clack/prompts";
import { isTTY } from "../utils/tty";

/**
 * Configuration for password component
 */
export interface PasswordConfig {
  /** Prompt message */
  prompt: string;
  /** Mask character (default: •) */
  mask?: string;
  /** Validation function */
  validate?: (value: string | undefined) => string | Error | undefined;
}

/**
 * Prompt for password input with masked characters
 *
 * @example
 * ```typescript
 * const secret = await password({
 *   prompt: "Enter your API key",
 *   validate: (value) => {
 *     if (value.length < 8) return "Password must be at least 8 characters";
 *   }
 * });
 * ```
 */
export async function password(config: PasswordConfig): Promise<string> {
  // Non-TTY fallback: throw error (passwords should never have defaults)
  if (!isTTY()) {
    if (process.env.CLAI_MCP_MODE === "true") {
      throw new Error(
        "Password input not available in MCP mode. Sensitive credentials should be provided via environment variables or the tool's inputSchema.",
      );
    }

    throw new Error(
      "Password input not available in non-TTY mode. Please provide credentials via environment variables.",
    );
  }

  const result = await p.password({
    message: config.prompt,
    mask: config.mask ?? "•",
    validate: config.validate,
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return result;
}
