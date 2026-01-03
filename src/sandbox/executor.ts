#!/usr/bin/env bun

/**
 * Sandbox Executor - Entry point for sandboxed child process
 * This file runs inside the sandbox and:
 * 1. Receives initialization message from host via IPC
 * 2. Loads and executes the user's script
 * 3. Provides sandboxed context to the script
 * 4. Sends execution results back to host
 */

import { TIMEOUTS } from "../shared/constants";
import { ExitWarning } from "../shared/errors";
import type {
  ExecutionCompleteMessage,
  IPCResponse,
  SandboxInitMessage,
} from "../shared/ipc-protocol";
import { isIPCResponse, isSandboxInitMessage } from "../shared/ipc-protocol";
import { error } from "../ui";
import { createSandboxedModelsContext } from "./sandboxed-context";

/**
 * Global state for the sandbox
 */
let initMessage: SandboxInitMessage | null = null;
const pendingIPCResponses = new Map<
  string,
  {
    resolve: (value: IPCResponse) => void;
    reject: (error: Error) => void;
  }
>();

/**
 * Set up IPC communication
 */
function setupIPC() {
  if (!process.send) {
    throw new Error("IPC channel not available");
  }

  process.on("message", (message: unknown) => {
    // Handle init message
    if (isSandboxInitMessage(message)) {
      initMessage = message;
      // Start execution once we receive init
      executeUserScript().catch((error) => {
        sendExecutionComplete(false, undefined, error.message);
        process.exit(1);
      });
      return;
    }

    // Handle IPC responses
    if (isIPCResponse(message)) {
      const pending = pendingIPCResponses.get(message.id);
      if (pending) {
        pendingIPCResponses.delete(message.id);
        pending.resolve(message);
      }
      return;
    }
  });
}

/**
 * Send IPC request to host and wait for response
 */
export function sendIPCRequest<T>(type: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error("IPC channel not available"));
      return;
    }

    const id = `${type}-${Date.now()}-${Math.random()}`;
    const request = { type, id, payload };

    // Store pending promise
    pendingIPCResponses.set(id, {
      resolve: (response: IPCResponse) => {
        if (response.success) {
          resolve(response.data as T);
        } else if (response.cancelled) {
          reject(new ExitWarning(response.error));
        } else {
          reject(new Error(response.error));
        }
      },
      reject,
    });

    // Send request
    process.send(request);

    // Timeout for standard IPC requests
    setTimeout(() => {
      const pending = pendingIPCResponses.get(id);
      if (pending) {
        pendingIPCResponses.delete(id);
        pending.reject(new Error("IPC request timeout"));
      }
    }, TIMEOUTS.IPC_REQUEST);
  });
}

/**
 * Execute the user's script
 */
async function executeUserScript(): Promise<void> {
  if (!initMessage) {
    throw new Error("No initialization message received");
  }

  const { scriptPath, args, invokeDir } = initMessage;

  try {
    // Set environment for the script
    process.argv = ["bun", scriptPath, ...args];
    process.env.KLY_SANDBOX_MODE = "true";

    // Inject sandboxed context into global scope
    // This allows defineApp to access the sandboxed context
    (
      global as { __KLY_SANDBOXED_CONTEXT__?: unknown }
    ).__KLY_SANDBOXED_CONTEXT__ = {
      modelsContext: createSandboxedModelsContext(),
      invokeDir,
    };

    // Import and execute the user's script
    // The script should use defineApp which will auto-execute in CLI mode
    // Bun will resolve modules relative to the script's directory automatically
    await import(scriptPath);

    // If we reach here without error, execution succeeded
    sendExecutionComplete(true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendExecutionComplete(false, undefined, errorMessage);
    throw error;
  }
}

/**
 * Send execution complete message to host
 */
function sendExecutionComplete(
  success: boolean,
  result?: unknown,
  error?: string,
): void {
  if (!process.send) {
    return;
  }

  const message: ExecutionCompleteMessage = {
    type: "complete",
    success,
    result,
    error,
  };

  process.send(message);
}

/**
 * Main entry point
 */
function main() {
  // Ensure we're in sandbox mode
  if (process.env.KLY_SANDBOX_MODE !== "true") {
    error("This script must be run in sandbox mode");
    process.exit(1);
  }

  // Setup IPC
  setupIPC();

  // Wait for init message (handled by IPC listener)
}

// Start the executor
main();
