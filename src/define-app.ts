import { createModelsContext } from "./ai/context";
import {
  generateMultiToolsHelp,
  generateSingleToolHelp,
  generateToolHelp,
  getMissingRequiredFields,
  isHelpRequested,
  isVersionRequested,
  parseCliArgs,
  parseSubcommand,
} from "./cli";
import { EXIT_CODES } from "./shared/constants";
import { ExitError, ExitWarning } from "./shared/errors";
import { detectMode, isSandbox } from "./shared/runtime-mode";
import type { AnyTool, AppDefinition, KlyApp } from "./types";
import { ValidationError } from "./types";
import { cancel, error, form, isTTY, output, select } from "./ui";

/**
 * Get the appropriate models context based on runtime environment
 */
async function _getModelsContext() {
  if (isSandbox()) {
    // In sandbox: use IPC-based context
    // Dynamic import for runtime-specific module loading
    const m = await import("./sandbox/sandboxed-context");
    return m.getSandboxedContext().modelsContext;
  }
  // Outside sandbox: use direct file access
  return createModelsContext();
}

/**
 * Get the invoke directory based on runtime environment
 */
async function _getInvokeDir(): Promise<string | undefined> {
  if (isSandbox()) {
    // In sandbox: get from sandboxed context
    const m = await import("./sandbox/sandboxed-context");
    return m.getSandboxedContext().invokeDir;
  }
  // Outside sandbox: not available (programmatic mode)
  return undefined;
}

/**
 * Define a Kly app with tools
 *
 * @example
 * ```typescript
 * import { defineApp, tool } from "kly"
 * import { z } from "zod"
 *
 * const helloTool = tool({
 *   name: "hello",
 *   description: "Say hello",
 *   inputSchema: z.object({ name: z.string() }),
 *   execute: async ({ name }) => `Hello, ${name}!`,
 * })
 *
 * defineApp({
 *   name: "my-app",
 *   version: "0.1.0",
 *   description: "My CLI app",
 *   tools: [helloTool],
 * })
 * // CLI: `my-app hello --name=World`
 * // MCP: exposes tool as my-app_hello
 * ```
 */
export function defineApp<TTools extends AnyTool[]>(
  definition: AppDefinition<TTools>,
): KlyApp<TTools> {
  // Normalize definition with defaults
  const fullDefinition: AppDefinition<TTools> = {
    name: definition.name ?? "unknown",
    version: definition.version ?? "0.0.0",
    description: definition.description ?? "",
    tools: definition.tools,
    instructions: definition.instructions,
    permissions: definition.permissions,
  };

  // Build tools map
  const toolsMap = new Map<string, AnyTool>();
  for (const tool of fullDefinition.tools) {
    toolsMap.set(tool.name, tool);
  }

  const app: KlyApp<TTools> = {
    definition: fullDefinition,
    tools: toolsMap,

    async execute(toolName: string, providedArgs?: Record<string, unknown>): Promise<unknown> {
      const mode = detectMode();
      const tool = toolsMap.get(toolName);

      if (!tool) {
        const available = Array.from(toolsMap.keys()).join(", ");
        throw new Error(`Unknown tool: ${toolName}. Available tools: ${available}`);
      }

      // Validate with schema
      const result = await tool.inputSchema["~standard"].validate(providedArgs ?? {});

      if (result.issues) {
        throw new ValidationError(result.issues);
      }

      // Execute with appropriate context (sandboxed or direct)
      const execResult = await tool.execute(result.value, {
        mode,
        models: await _getModelsContext(),
        invokeDir: await _getInvokeDir(),
      });
      return execResult;
    },
  };

  // Auto-run based on mode
  const mode = detectMode();
  if (mode === "cli") {
    runCli(app, fullDefinition).catch((err) => {
      // Check for ExitWarning (user cancellation - graceful exit)
      const isExitWarning = err instanceof ExitWarning || err?.name === "ExitWarning";
      if (isExitWarning) {
        if (err.message) {
          cancel(err.message);
        }
        process.exit(EXIT_CODES.CANCELLED);
      }

      // Check for ExitError
      const isExitError = err instanceof ExitError || err?.name === "ExitError";
      const exitCode = isExitError ? (err.exitCode ?? 1) : 1;
      const message = typeof err === "string" ? err : err?.message || String(err);

      if (isExitError) {
        if (message) {
          error(message);
        }
      } else {
        error("Fatal error:", [message]);
      }

      process.exit(exitCode);
    });
  } else if (mode === "mcp") {
    // Dynamically import MCP server to avoid bundling it in CLI mode
    import("./mcp").then(({ startMcpServer }) => {
      startMcpServer(app).catch((err) => {
        const message = typeof err === "string" ? err : err?.message || String(err);
        error("MCP server error:", [message]);
        process.exit(1);
      });
    });
  }

  return app;
}

/**
 * Run app in CLI mode
 */
async function runCli<TTools extends AnyTool[]>(
  app: KlyApp<TTools>,
  definition: AppDefinition<TTools>,
): Promise<void> {
  const argv = process.argv.slice(2);
  const isSingleTool = definition.tools.length === 1;

  // Handle --help and --version without TUI
  if (isHelpRequested(argv)) {
    if (isSingleTool) {
      output(generateSingleToolHelp(definition, definition.tools[0]!));
    } else {
      const { subcommand } = parseSubcommand(argv);
      if (subcommand) {
        const tool = app.tools.get(subcommand);
        if (tool) {
          output(generateToolHelp(definition.name ?? "unknown", tool));
        } else {
          output(generateMultiToolsHelp(definition));
        }
      } else {
        output(generateMultiToolsHelp(definition));
      }
    }
    return;
  }

  if (isVersionRequested(argv)) {
    output(`${definition.name ?? "unknown"} v${definition.version ?? "0.0.0"}`);
    return;
  }

  // Run the appropriate CLI mode
  if (isSingleTool) {
    await runSingleToolCli(app, definition);
  } else {
    await runMultiToolsCli(app, definition);
  }
  // Clean exit
  process.exit(0);
}

/**
 * Run single tool app in CLI mode (no subcommand needed)
 */
async function runSingleToolCli<TTools extends AnyTool[]>(
  app: KlyApp<TTools>,
  definition: AppDefinition<TTools>,
): Promise<void> {
  const argv = process.argv.slice(2);
  const tool = definition.tools[0]!;
  const interactive = isTTY();

  // Parse args
  let parsedArgs = parseCliArgs(argv) as Record<string, unknown>;

  // Check for missing required fields and prompt if in TTY mode
  // In sandbox mode, form() will use IPC to prompt in the host process
  if (interactive) {
    const missingFields = getMissingRequiredFields(tool.inputSchema, parsedArgs);

    if (missingFields.length > 0) {
      const additionalArgs = await form({ fields: missingFields });
      parsedArgs = { ...parsedArgs, ...additionalArgs };
    }
  }

  try {
    const result = await app.execute(tool.name, parsedArgs);
    if (result !== undefined) {
      output(result);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new ExitError(`${err.message}\nRun with --help for usage information.`);
    }
    throw err;
  }
}

/**
 * Run multi tools app in CLI mode (with subcommands)
 */
async function runMultiToolsCli<TTools extends AnyTool[]>(
  app: KlyApp<TTools>,
  definition: AppDefinition<TTools>,
): Promise<void> {
  const argv = process.argv.slice(2);
  let { subcommand } = parseSubcommand(argv);
  const interactive = isTTY();

  // Get rest args (subcommand already parsed above)
  const { args: restArgs } = parseSubcommand(argv);

  // Interactive tool selection if no subcommand and in TTY mode
  // In sandbox mode, select() will use IPC to prompt in the host process
  if (!subcommand) {
    if (interactive) {
      // Show interactive menu to select a tool
      const toolOptions = definition.tools.map((t) => ({
        name: t.name,
        description: t.description,
        value: t.name,
      }));
      subcommand = await select({
        options: toolOptions,
        prompt: `${definition.name} - Select a command`,
      });
    } else {
      throw new ExitError(
        `No subcommand provided.\nAvailable commands: ${definition.tools.map((t) => t.name).join(", ")}\nRun '${definition.name} --help' for usage.`,
      );
    }
  }

  // At this point subcommand is guaranteed to be a string
  const selectedCommand = subcommand as string;

  const tool = app.tools.get(selectedCommand);
  if (!tool) {
    throw new ExitError(
      `Unknown command '${selectedCommand}'.\nAvailable commands: ${definition.tools.map((t) => t.name).join(", ")}\nRun '${definition.name} --help' for usage.`,
    );
  }

  // Parse args
  let parsedArgs = parseCliArgs(restArgs) as Record<string, unknown>;

  // Check for missing required fields and prompt if in TTY mode
  // In sandbox mode, form() will use IPC to prompt in the host process
  if (interactive) {
    const missingFields = getMissingRequiredFields(tool.inputSchema, parsedArgs);

    if (missingFields.length > 0) {
      const additionalArgs = await form({ fields: missingFields });
      parsedArgs = { ...parsedArgs, ...additionalArgs };
    }
  }

  try {
    const result = await app.execute(selectedCommand, parsedArgs);
    if (result !== undefined) {
      output(result);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new ExitError(
        `${err.message}\nRun '${definition.name} ${selectedCommand} --help' for usage.`,
      );
    }
    throw err;
  }
}
