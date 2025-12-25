#!/usr/bin/env bun
import { resolve } from "node:path";

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
    const filePath = args[1];
    if (!filePath) {
      console.error("Error: Missing file path");
      console.error("Usage: clai run <file>");
      process.exit(1);
    }
    await runFile(filePath, args.slice(2));
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

function showHelp() {
  console.log(`
clai - Command Line AI

Usage:
  clai <command> [options]

Commands:
  run <file>     Run a Clai app from local file

Options:
  --help, -h     Show help
  --version, -v  Show version

Examples:
  clai run ./my-tool.ts
  clai run ./my-tool.ts --name=World
  clai run ./weather.ts current --city=Beijing
`);
}

function showVersion() {
  console.log("0.1.0");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
