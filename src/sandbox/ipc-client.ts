import { TIMEOUTS } from "../shared/constants";
import type { IPCRequest, IPCResponse } from "../shared/ipc-protocol";

/**
 * Send an IPC request to the host and wait for response
 * Used by UI components and other sandbox code to communicate with the host process
 */
export async function sendIPCRequest<T>(
  type: IPCRequest["type"],
  payload: unknown,
): Promise<T> {
  if (!process.send) {
    throw new Error("IPC not available - not running in sandbox mode");
  }

  return new Promise((resolve, reject) => {
    const requestId = `${type}-${Date.now()}-${Math.random()}`;

    const request: IPCRequest = {
      type,
      id: requestId,
      payload,
    } as IPCRequest;

    // Set up response listener
    const responseHandler = (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "response" &&
        "id" in message &&
        message.id === requestId
      ) {
        process.off("message", responseHandler);

        const response = message as IPCResponse<T>;
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      }
    };

    process.on("message", responseHandler);

    // Send request
    if (!process.send!(request)) {
      // Send failed immediately
      process.off("message", responseHandler);
      reject(new Error("Failed to send IPC message"));
      return;
    }

    // Timeout for long-running requests (prompts, etc.)
    setTimeout(() => {
      process.off("message", responseHandler);
      reject(new Error(`IPC request timeout: ${type}`));
    }, TIMEOUTS.IPC_LONG_REQUEST);
  });
}
