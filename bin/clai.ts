#!/usr/bin/env bun
import { resolve } from "node:path";
import { isRemoteRef, runRemote } from "../src/remote";

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

  // Modify process.argv so defineApp's detectMode() works correctly
  // It checks if argv[1] ends with .ts/.js to determine CLI mode
  process.argv = ["bun", absolutePath, ...appArgs];

  // Dynamic import triggers defineApp's auto-execution
  await import(absolutePath);
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
