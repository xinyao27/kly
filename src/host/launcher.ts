import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import type {
  ExecutionCompleteMessage,
  SandboxInitMessage,
} from "../shared/ipc-protocol";
import {
  isExecutionCompleteMessage,
  isIPCRequest,
} from "../shared/ipc-protocol";
import { createResourceProvider } from "./resource-provider";

export interface LaunchOptions {
  scriptPath: string;
  args: string[];
  appId: string;
  /** Working directory where `kly run` was invoked */
  invokeDir: string;
  sandboxConfig: SandboxRuntimeConfig;
  allowApiKey: boolean;
}

export interface LaunchResult {
  exitCode: number;
  result?: unknown;
  error?: string;
}

/**
 * Launch a user script in a sandboxed child process
 * This is the Host-side launcher that:
 * 1. Spawns a child process with IPC
 * 2. Applies OS-level sandboxing
 * 3. Handles IPC communication for resource access
 * 4. Returns execution result
 */
export async function launchSandbox(
  options: LaunchOptions,
): Promise<LaunchResult> {
  const { scriptPath, args, appId, invokeDir, sandboxConfig, allowApiKey } =
    options;

  // Initialize sandbox manager
  await SandboxManager.initialize(sandboxConfig);

  // Resolve paths
  const absoluteScriptPath = resolve(process.cwd(), scriptPath);
  const _scriptDir = absoluteScriptPath.substring(
    0,
    absoluteScriptPath.lastIndexOf("/"),
  );

  // Find executor path based on current location
  // Development: src/host/launcher.ts -> src/sandbox/executor.ts
  // Production: dist/bin/kly.mjs (embedded) -> dist/sandbox/bundled-executor.mjs
  // __dirname from dist/bin/kly.mjs is dist/bin, so ../sandbox resolves to dist/sandbox
  // Use bundled-executor to avoid circular dependency issues
  const executorPath = resolve(__dirname, "../sandbox/bundled-executor.mjs");

  // Show sandbox info
  if (!SandboxManager.isSandboxingEnabled()) {
    console.warn("⚠️  Sandboxing is not supported on this platform.");
    console.warn("   Running without OS-level isolation.");
  } else {
    console.log("🔒 Sandbox Configuration:");
    console.log(
      `   Read denied: ${sandboxConfig.filesystem.denyRead.length} paths`,
    );
    console.log(
      `   Write allowed: ${sandboxConfig.filesystem.allowWrite.length} paths`,
    );
    console.log(
      `   Network: ${sandboxConfig.network.allowedDomains.join(", ") || "none"}`,
    );
    console.log("");
  }

  // Create the command to run in sandbox
  const command = `bun run ${executorPath}`;
  const wrappedCommand = await SandboxManager.wrapWithSandbox(command);

  // Spawn child process with IPC and inherited stdio for interactive input support
  // Using 'inherit' for stdin/stdout/stderr allows the child to directly access the TTY
  // This enables raw mode for interactive prompts (select, input, etc.)
  const child = spawn(wrappedCommand, {
    shell: true,
    stdio: ["inherit", "inherit", "inherit", "ipc"], // Inherit to support raw mode
    cwd: _scriptDir, // Set working directory to script's directory for module resolution
    env: {
      ...process.env,
      KLY_SANDBOX_MODE: "true",
    },
  });

  // Create resource provider for handling IPC requests
  const resourceProvider = createResourceProvider({
    appId,
    allowApiKey,
    sandboxConfig,
  });

  // Handle IPC messages from sandbox
  child.on("message", async (message: unknown) => {
    if (isIPCRequest(message)) {
      const response = await resourceProvider.handle(message);
      child.send(response);
    }
  });

  // Send initialization message to sandbox
  const initMessage: SandboxInitMessage = {
    type: "init",
    scriptPath: absoluteScriptPath,
    args,
    appId,
    invokeDir,
    permissions: {
      allowApiKey,
      sandboxConfig,
    },
  };
  child.send(initMessage);

  // Wait for execution to complete
  return new Promise((resolve, reject) => {
    let executionResult: ExecutionCompleteMessage | null = null;

    child.on("message", (message: unknown) => {
      if (isExecutionCompleteMessage(message)) {
        executionResult = message;
      }
    });

    child.on("error", (error) => {
      reject(new Error(`Sandbox process error: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (executionResult) {
        resolve({
          exitCode: code ?? 0,
          result: executionResult.result,
          error: executionResult.error,
        });
      } else {
        resolve({
          exitCode: code ?? 1,
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        });
      }
    });
  });
}
