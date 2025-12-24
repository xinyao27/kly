/* agent-frontmatter:start
AGENT: Core defineApp function
PURPOSE: Create Clai app instances with schema validation and multi-mode execution
USAGE: Main export for users to define their apps
EXPORTS: defineApp
FEATURES:
  - Standard Schema validation
  - CLI/MCP/programmatic mode detection
  - Auto-execution in CLI mode
  - Help and version handling
  - Subcommand support for tools
SEARCHABLE: defineApp, app, schema, validation, cli, mcp
agent-frontmatter:end */

import {
  generateMultiToolsHelp,
  generateToolHelp,
  isHelpRequested,
  isVersionRequested,
  parseCliArgs,
  parseSubcommand,
} from "./cli";
import type { AnyTool, AppDefinition, ClaiApp, RuntimeMode } from "./types";
import { ValidationError } from "./types";

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
      return tool.execute(result.value, { mode });
    },
  };

  // Auto-run in CLI mode
  const mode = detectMode();
  if (mode === "cli") {
    runCli(app, definition).catch((error) => {
      console.error("Fatal error:", error.message);
      process.exit(1);
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
  const isSingleTool = definition.tools.length === 1;

  if (isSingleTool) {
    await runSingleToolCli(app, definition);
  } else {
    await runMultiToolsCli(app, definition);
  }
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

  // Handle --help
  if (isHelpRequested(argv)) {
    const { generateSingleToolHelp } = await import("./cli");
    console.log(generateSingleToolHelp(definition, tool));
    return;
  }

  // Handle --version
  if (isVersionRequested(argv)) {
    console.log(`${definition.name} v${definition.version}`);
    return;
  }

  // Parse args and execute
  const parsedArgs = parseCliArgs(argv);

  try {
    const result = await app.execute(tool.name, parsedArgs);
    if (result !== undefined) {
      if (typeof result === "string") {
        console.log(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`Error: ${error.message}`);
      console.error("");
      console.error(`Run with --help for usage information.`);
      process.exit(1);
    }
    throw error;
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
  const { subcommand } = parseSubcommand(argv);

  // Handle --help (app level, no subcommand)
  if (isHelpRequested(argv) && !subcommand) {
    console.log(generateMultiToolsHelp(definition));
    return;
  }

  // Handle --version
  if (isVersionRequested(argv)) {
    console.log(`${definition.name} v${definition.version}`);
    return;
  }

  // Get rest args (subcommand already parsed above)
  const { args: restArgs } = parseSubcommand(argv);

  if (!subcommand) {
    console.error("Error: No subcommand provided.");
    console.error("");
    console.log(generateMultiToolsHelp(definition));
    process.exit(1);
  }

  const tool = app.tools.get(subcommand);
  if (!tool) {
    console.error(`Error: Unknown command '${subcommand}'.`);
    console.error("");
    console.log(generateMultiToolsHelp(definition));
    process.exit(1);
  }

  // Handle --help for specific tool
  if (isHelpRequested(restArgs)) {
    console.log(generateToolHelp(definition.name, tool));
    return;
  }

  // Parse args and execute
  const parsedArgs = parseCliArgs(restArgs);

  try {
    const result = await app.execute(subcommand, parsedArgs);
    if (result !== undefined) {
      if (typeof result === "string") {
        console.log(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`Error: ${error.message}`);
      console.error("");
      console.error(`Run '${definition.name} ${subcommand} --help' for usage.`);
      process.exit(1);
    }
    throw error;
  }
}
