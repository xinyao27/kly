#!/usr/bin/env bun
import { resolve } from "node:path";
import { isNaturalLanguage, parseNaturalLanguage, selectTool } from "../src/ai";
import { parseCliArgs } from "../src/cli";
import { isRemoteRef, runRemote } from "../src/remote";
import type { ClaiApp } from "../src/types";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    showVersion();
    return;
  }

  if (command === "models") {
    const { modelsCommand } = await import("../src/ai/models-command");
    await modelsCommand();
    return;
  }

  if (command === "run") {
    const target = args[1];
    if (!target) {
      console.error("Error: Missing file path or remote reference");
      console.error("Usage: clai run <file|user/repo[@ref]>");
      process.exit(1);
    }

    // Check for --force flag
    const forceIndex = args.indexOf("--force");
    const force = forceIndex !== -1;

    // Find -- separator for app arguments
    const dashDashIndex = args.indexOf("--");
    const appArgs =
      dashDashIndex !== -1
        ? args.slice(dashDashIndex + 1)
        : args.slice(2).filter((arg) => arg !== "--force");

    if (isRemoteRef(target)) {
      await runRemote(target, { args: appArgs, force });
    } else {
      await runFile(target, appArgs);
    }
    return;
  }

  if (command === "mcp") {
    const target = args[1];
    if (!target) {
      console.error("Error: Missing file path or remote reference");
      console.error("Usage: clai mcp <file|user/repo[@ref]>");
      process.exit(1);
    }

    // Check for --force flag
    const forceIndex = args.indexOf("--force");
    const force = forceIndex !== -1;

    if (isRemoteRef(target)) {
      await runRemote(target, { args: [], force, mcp: true });
    } else {
      await runFileAsMcp(target);
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error('Run "clai --help" for usage');
  process.exit(1);
}

async function runFile(filePath: string, appArgs: string[]) {
  const absolutePath = resolve(process.cwd(), filePath);

  // Check if first arg is natural language
  const firstArg = appArgs[0];
  const useNaturalLanguage = firstArg && isNaturalLanguage(firstArg);

  if (useNaturalLanguage) {
    // Natural language mode: parse with LLM
    await runFileWithNaturalLanguage(absolutePath, appArgs);
  } else {
    // Normal mode: pass through arguments
    // Modify process.argv so defineApp's detectMode() works correctly
    process.argv = ["bun", absolutePath, ...appArgs];

    // Dynamic import triggers defineApp's auto-execution
    await import(absolutePath);
  }
}

async function runFileWithNaturalLanguage(
  absolutePath: string,
  appArgs: string[],
) {
  // Set programmatic mode to prevent auto-execution
  process.env.CLAI_PROGRAMMATIC = "true";

  // Import the app
  const module = await import(absolutePath);

  // Reset programmatic mode
  delete process.env.CLAI_PROGRAMMATIC;

  // Get the app instance (should be default export)
  const app: ClaiApp = module.default;

  if (!app || typeof app.execute !== "function") {
    console.error(
      "Error: The app file must export a ClaiApp instance as default export",
    );
    console.error("Make sure you call defineApp() and it returns the result");
    process.exit(1);
  }

  // Parse CLI args (--flags)
  const parsedFlags = parseCliArgs(appArgs);

  // Collect natural language input (non-flag args)
  const naturalInput = appArgs.filter((arg) => !arg.startsWith("-")).join(" ");

  // Determine which tool to use
  let toolName: string;
  if (app.definition.tools.length === 1) {
    // Single tool app
    toolName = app.definition.tools[0]!.name;
  } else if (parsedFlags.tool) {
    // Multi-tool app with explicit tool selection
    toolName = String(parsedFlags.tool);
    delete parsedFlags.tool; // Remove from args
  } else {
    // Multi-tool app without tool selection - use AI to select
    try {
      toolName = await selectTool(
        naturalInput,
        app.definition.tools.map((t) => ({
          name: t.name,
          description: t.description || "",
        })),
      );
    } catch (error) {
      console.error("Error: Failed to automatically select tool");
      console.error(error instanceof Error ? error.message : String(error));
      console.error(
        `\nAvailable tools: ${app.definition.tools.map((t) => t.name).join(", ")}`,
      );
      console.error("\nYou can manually specify a tool with --tool=<name>");
      process.exit(1);
    }
  }

  const tool = app.tools.get(toolName);
  if (!tool) {
    console.error(`Error: Unknown tool '${toolName}'`);
    console.error(
      `Available tools: ${app.definition.tools.map((t) => t.name).join(", ")}`,
    );
    process.exit(1);
  }

  // Parse natural language to extract parameters
  const parsedParams = await parseNaturalLanguage(
    naturalInput,
    tool.inputSchema,
    parsedFlags,
  );

  // Execute the tool
  const result = await app.execute(toolName, parsedParams);

  // Output result
  if (result !== undefined) {
    if (typeof result === "string") {
      console.log(result);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

async function runFileAsMcp(filePath: string) {
  const absolutePath = resolve(process.cwd(), filePath);

  // Set MCP mode environment variable
  process.env.CLAI_MCP_MODE = "true";

  // Modify process.argv
  process.argv = ["bun", absolutePath];

  // Dynamic import triggers defineApp's auto-execution in MCP mode
  await import(absolutePath);
}

function showHelp() {
  console.log(`
clai - Command Line AI

Usage:
  clai <command> [options]

Commands:
  models         Manage LLM model configurations
  run <target>   Run a Clai app
  mcp <target>   Start an MCP server for a Clai app

Target can be:
  ./file.ts              Local file
  user/repo              GitHub repo (main branch)
  user/repo@v1.0.0       GitHub repo at specific tag
  user/repo@branch       GitHub repo at specific branch

Options:
  --force        Force re-fetch remote repo (ignore cache)
  --help, -h     Show help
  --version, -v  Show version

Examples:
  clai models
  clai run ./my-tool.ts
  clai run ./my-tool.ts --name=World
  clai run user/weather-app
  clai run user/weather-app@v1.0.0
  clai run user/weather-app -- --city=Beijing
  clai mcp ./my-tool.ts
  clai mcp user/weather-app
`);
}

function showVersion() {
  console.log("0.1.0");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
