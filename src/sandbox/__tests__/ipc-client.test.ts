import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { TIMEOUTS } from "../../shared/constants";

describe("sandbox/ipc-client", () => {
  describe("sendIPCRequest timeout constants", () => {
    it("uses TIMEOUTS.IPC_LONG_REQUEST for timeout value", () => {
      // Verify the constant is properly imported and used
      expect(TIMEOUTS.IPC_LONG_REQUEST).toBe(60_000);
    });

    it("has reasonable timeout for long-running IPC requests", () => {
      expect(TIMEOUTS.IPC_LONG_REQUEST).toBeGreaterThan(30_000);
      expect(TIMEOUTS.IPC_LONG_REQUEST).toBeLessThanOrEqual(60_000);
    });
  });

  describe("IPC request/response flow", () => {
    let originalProcessSend: typeof process.send;
    let originalProcessOn: typeof process.on;
    let originalProcessOff: typeof process.off;

    beforeEach(() => {
      originalProcessSend = process.send;
      originalProcessOn = process.on;
      originalProcessOff = process.off;
    });

    afterEach(() => {
      process.send = originalProcessSend;
      process.on = originalProcessOn;
      process.off = originalProcessOff;
    });

    it("throws error when process.send is not available", async () => {
      // Mock process.send as undefined (not in IPC mode)
      process.send = undefined as any;

      const { sendIPCRequest } = await import("../ipc-client");

      await expect(sendIPCRequest("listModels", {})).rejects.toThrow(
        "IPC not available",
      );
    });

    it("generates unique request IDs", () => {
      const requestIds: string[] = [];

      // Mock process.send to capture request IDs only
      process.send = mock((message: any) => {
        requestIds.push(message.id);
        return true;
      }) as any;

      // Mock process.on to capture listener registration
      process.on = mock(() => {}) as any;

      // Import directly to test ID generation
      const ipcModule = require("../ipc-client");

      // Create multiple requests (without awaiting - just to generate IDs)
      ipcModule.sendIPCRequest("listModels", {}).catch(() => {});
      ipcModule
        .sendIPCRequest("getModelConfig", { name: "test" })
        .catch(() => {});
      ipcModule
        .sendIPCRequest("log", { level: "info", message: "test" })
        .catch(() => {});

      // IDs are generated synchronously during the call
      // All IDs should be unique
      expect(new Set(requestIds).size).toBe(3);
      expect(requestIds.length).toBe(3);

      // IDs should follow the pattern: type-timestamp-random
      for (const id of requestIds) {
        expect(id).toMatch(/^.+-\d+-0\.\d+$/);
      }
    });

    it("rejects with error when send returns false", async () => {
      // Mock process.send to return false (send failed)
      process.send = mock(() => false) as any;
      process.on = mock(() => {}) as any;
      process.off = mock(() => {}) as any;

      const { sendIPCRequest } = await import("../ipc-client");

      await expect(sendIPCRequest("listModels", {})).rejects.toThrow(
        "Failed to send IPC message",
      );
    });
  });

  describe("IPC message structure", () => {
    it("creates properly formatted IPC request", async () => {
      let capturedRequest: any;

      process.send = mock((message: any) => {
        capturedRequest = message;
        return true;
      }) as any;
      process.on = mock(() => {}) as any;

      const { sendIPCRequest } = await import("../ipc-client");

      // Create a request (will timeout, but we just want to check the structure)
      sendIPCRequest("getModelConfig", { name: "test" }).catch(() => {});

      // Wait a bit for the send to happen
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest.type).toBe("getModelConfig");
      expect(capturedRequest.id).toBeDefined();
      expect(capturedRequest.payload).toEqual({ name: "test" });
    });
  });
});
