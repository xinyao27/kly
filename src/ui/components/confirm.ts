import * as p from "@clack/prompts";
import { sendIPCRequest } from "../../sandbox/ipc-client";
import { isMCP, isSandbox } from "../../shared/runtime-mode";
import { handleCancel } from "../utils/cancel";
import { isTTY } from "../utils/tty";

/**
 * Simplified confirm function
 *
 * @example
 * ```typescript
 * const proceed = await confirm("Continue?", true);
 * ```
 */
export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  // Sandbox mode: use IPC to request confirm from host
  if (isSandbox()) {
    return sendIPCRequest<boolean>("prompt:confirm", { message, defaultValue });
  }

  if (!isTTY()) {
    // In MCP mode, warn about using default value for confirmation
    if (isMCP()) {
      p.log.warn(
        `[MCP] Interactive confirmation not available. Using default value (${defaultValue}) for: ${message}`,
      );
    }
    return defaultValue;
  }

  const result = await p.confirm({
    message,
    initialValue: defaultValue,
  });

  return handleCancel(result);
}
