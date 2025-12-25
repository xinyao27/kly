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
import type { AnyTool, AppDefinition, ClaiApp, RuntimeMode } from "./types";
import { ValidationError } from "./types";
import { error, form, isTTY, output, select } from "./ui";

/**
 * Detect the current runtime mode
 */
function detectMode(): RuntimeMode {
  // MCP mode: Check for MCP environment variable
  if (process.env.CLAI_MCP_MODE === "true") {
    return "mcp";
  }

  // Programmatic mode: Check for explicit flag
  if (process.env.CLAI_PROGRAMMATIC === "true") {
    return "programmatic";
  }

  // CLI mode: Running a .ts file directly with bun
  const scriptPath = process.argv[1] ?? "";
  const isDirectRun = scriptPath.endsWith(".ts") || scriptPath.endsWith(".js");
  if (isDirectRun) {
    return "cli";
  }

  // Default to programmatic (e.g., when imported as a module)
  return "programmatic";
}

/**
 * Define a Clai app with tools
 *
 * @example
 * ```typescript
 * import { defineApp, tool } from "clai"
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
): ClaiApp<TTools> {
  // Build tools map
  const toolsMap = new Map<string, AnyTool>();
  for (const tool of definition.tools) {
    toolsMap.set(tool.name, tool);
  }

  const app: ClaiApp<TTools> = {
    definition,
    tools: toolsMap,

    async execute(
      toolName: string,
      providedArgs?: Record<string, unknown>,
    ): Promise<unknown> {
      const mode = detectMode();
      const tool = toolsMap.get(toolName);

      if (!tool) {
        const available = Array.from(toolsMap.keys()).join(", ");
        throw new Error(
          `Unknown tool: ${toolName}. Available tools: ${available}`,
        );
      }

      // Validate with schema
      const result = await tool.inputSchema["~standard"].validate(
        providedArgs ?? {},
      );

      if (result.issues) {
        throw new ValidationError(result.issues);
      }

      // Execute
      const execResult = await tool.execute(result.value, { mode });
      return execResult;
    },
  };

  // Auto-run based on mode
  const mode = detectMode();
  if (mode === "cli") {
    runCli(app, definition).catch((err) => {
      console.error("Fatal error:", err.message);
      process.exit(1);
    });
  } else if (mode === "mcp") {
    // Dynamically import MCP server to avoid bundling it in CLI mode
    import("./mcp").then(({ startMcpServer }) => {
      startMcpServer(app).catch((err) => {
        console.error("MCP server error:", err.message);
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
  app: ClaiApp<TTools>,
  definition: AppDefinition<TTools>,
): Promise<void> {
  const argv = process.argv.slice(2);
  const isSingleTool = definition.tools.length === 1;

  // Handle --help and --version without TUI
  if (isHelpRequested(argv)) {
    if (isSingleTool) {
      console.log(generateSingleToolHelp(definition, definition.tools[0]!));
    } else {
      const { subcommand } = parseSubcommand(argv);
      if (subcommand) {
        const tool = app.tools.get(subcommand);
        if (tool) {
          console.log(generateToolHelp(definition.name, tool));
        } else {
          console.log(generateMultiToolsHelp(definition));
        }
      } else {
        console.log(generateMultiToolsHelp(definition));
      }
    }
    return;
  }

  if (isVersionRequested(argv)) {
    console.log(`${definition.name} v${definition.version}`);
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
  app: ClaiApp<TTools>,
  definition: AppDefinition<TTools>,
): Promise<void> {
  const argv = process.argv.slice(2);
  const tool = definition.tools[0]!;
  const interactive = isTTY();

  // Parse args
  let parsedArgs = parseCliArgs(argv) as Record<string, unknown>;

  // Check for missing required fields and prompt if in TTY mode
  if (interactive) {
    const missingFields = getMissingRequiredFields(
      tool.inputSchema,
      parsedArgs,
    );

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
      error(err.message, [`Run with --help for usage information.`]);
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Run multi tools app in CLI mode (with subcommands)
 */
async function runMultiToolsCli<TTools extends AnyTool[]>(
  app: ClaiApp<TTools>,
  definition: AppDefinition<TTools>,
): Promise<void> {
  const argv = process.argv.slice(2);
  let { subcommand } = parseSubcommand(argv);
  const interactive = isTTY();

  // Get rest args (subcommand already parsed above)
  const { args: restArgs } = parseSubcommand(argv);

  // Interactive tool selection if no subcommand and in TTY mode
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
      error("No subcommand provided.", [
        `Available commands: ${definition.tools.map((t) => t.name).join(", ")}`,
        `Run '${definition.name} --help' for usage.`,
      ]);
      process.exit(1);
    }
  }

  // At this point subcommand is guaranteed to be a string
  const selectedCommand = subcommand as string;

  const tool = app.tools.get(selectedCommand);
  if (!tool) {
    error(`Unknown command '${selectedCommand}'.`, [
      `Available commands: ${definition.tools.map((t) => t.name).join(", ")}`,
      `Run '${definition.name} --help' for usage.`,
    ]);
    process.exit(1);
  }

  // Parse args
  let parsedArgs = parseCliArgs(restArgs) as Record<string, unknown>;

  // Check for missing required fields and prompt if in TTY mode
  if (interactive) {
    const missingFields = getMissingRequiredFields(
      tool.inputSchema,
      parsedArgs,
    );

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
      error(err.message, [
        `Run '${definition.name} ${selectedCommand} --help' for usage.`,
      ]);
      process.exit(1);
    }
    throw err;
  }
}
