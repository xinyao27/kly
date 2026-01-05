#!/usr/bin/env bun
import { dirname, resolve } from "node:path";
import { modelsCommand } from "../src/ai/models-command";
import {
  autoRegisterBins,
  detectBins,
  getCommand,
  shouldReregisterLocal,
} from "../src/bin-registry";
import {
  installCommand,
  linkCommand,
  listCommand,
  uninstallCommand,
} from "../src/bin-registry/commands";
import { waitForAppCompletion } from "../src/define-app";
import { isRemoteRef, runRemote } from "../src/remote";
import { ExitError, ExitWarning } from "../src/shared/errors";
import { cancel, colors, error, intro, log, outro } from "../src/ui";

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<number | undefined> {
  intro(`${colors.bgHex("#dc7702")(colors.black(` Kly ${colors.italic(__VERSION__)} `))}`);

  if (!command || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    showVersion();
    return;
  }

  if (command === "models") {
    await modelsCommand();
    return;
  }

  if (command === "install") {
    await installCommand(args.slice(1));
    return;
  }

  if (command === "uninstall") {
    await uninstallCommand(args.slice(1));
    return;
  }

  if (command === "link") {
    await linkCommand(args.slice(1));
    return;
  }

  if (command === "list" || command === "ls") {
    await listCommand();
    return;
  }

  if (command === "run") {
    const target = args[1];
    if (!target) {
      throw new ExitError(
        "Missing file path or remote reference\nUsage: kly run <file|user/repo[@ref]>",
      );
    }

    // Check for flags
    const forceIndex = args.indexOf("--force");
    const force = forceIndex !== -1;
    const noUpdateCheckIndex = args.indexOf("--no-update-check");
    const skipUpdateCheck = noUpdateCheckIndex !== -1;

    // Find -- separator for app arguments
    const dashDashIndex = args.indexOf("--");
    const appArgs =
      dashDashIndex !== -1
        ? args.slice(dashDashIndex + 1)
        : args.slice(2).filter((arg) => arg !== "--force" && arg !== "--no-update-check");

    if (isRemoteRef(target)) {
      await runRemote(target, { args: appArgs, force, skipUpdateCheck });
    } else {
      await runFile(target, appArgs);
    }
    // Wait for app to complete and return its exit code
    return await waitForAppCompletion();
  }

  if (command === "mcp") {
    const target = args[1];
    if (!target) {
      throw new ExitError(
        "Missing file path or remote reference\nUsage: kly mcp <file|user/repo[@ref]>",
      );
    }

    // Check for flags
    const forceIndex = args.indexOf("--force");
    const force = forceIndex !== -1;
    const noUpdateCheckIndex = args.indexOf("--no-update-check");
    const skipUpdateCheck = noUpdateCheckIndex !== -1;

    if (isRemoteRef(target)) {
      await runRemote(target, { args: [], force, skipUpdateCheck, mcp: true });
    } else {
      await runFileAsMcp(target);
    }
    // MCP mode runs indefinitely - wait forever (process will be killed externally)
    await new Promise(() => {});
  }

  throw new ExitError(`Unknown command: ${command}\nRun "kly --help" for usage`);
}

async function runFile(filePath: string, appArgs: string[]) {
  const absolutePath = resolve(process.cwd(), filePath);

  // Set process.argv for the app
  process.argv = ["bun", absolutePath, ...appArgs];

  // Import and execute the app
  await import(absolutePath);

  // Auto-register bin commands for local projects
  const projectPath = dirname(absolutePath);
  const detection = detectBins(projectPath);

  if (detection.hasBin) {
    // Check if any commands need re-registration (local project code changed)
    let needsUpdate = false;
    for (const [cmdName] of Object.entries(detection.bins)) {
      if (shouldReregisterLocal(cmdName, projectPath)) {
        needsUpdate = true;
        break;
      }
    }

    if (needsUpdate) {
      // Auto-update without asking
      await autoRegisterBins(projectPath, {
        type: "local",
        force: true,
        skipConfirm: true,
      });
    } else {
      // Check if this is the first time (not registered yet)
      const firstBinCmd = Object.keys(detection.bins)[0];
      if (firstBinCmd) {
        const existing = getCommand(firstBinCmd);

        if (!existing) {
          // First time - ask user
          await autoRegisterBins(projectPath, {
            type: "local",
            skipConfirm: false,
          });
        }
      }
    }
  }
}

async function runFileAsMcp(filePath: string) {
  const absolutePath = resolve(process.cwd(), filePath);

  // Set MCP mode environment variable
  process.env.KLY_MCP_MODE = "true";

  // Modify process.argv
  process.argv = ["bun", absolutePath];

  // Dynamic import triggers defineApp's auto-execution in MCP mode
  await import(absolutePath);
}

function showHelp() {
  log.message(`Usage:
  kly <command> [options]

Commands:
  models           Manage LLM model configurations
  run <target>     Run a Kly app
  mcp <target>     Start an MCP server for a Kly app
  install <target> Install a Kly app as global command
  uninstall <cmd>  Uninstall a registered global command
  link [path]      Link a local project as global command
  list             List all registered global commands

Target can be:
  ./file.ts              Local file
  user/repo              GitHub repo (main branch)
  user/repo@v1.0.0       GitHub repo at specific tag
  user/repo@branch       GitHub repo at specific branch

Options:
  --force              Force re-fetch remote repo (ignore cache)
  --no-update-check    Skip checking for remote updates
  --help, -h           Show help
  --version, -v        Show version

Examples:
  kly models
  kly run ./my-tool.ts
  kly run ./my-tool.ts --name=World
  kly run user/weather-app
  kly run user/weather-app@v1.0.0
  kly run user/weather-app -- --city=Beijing
  kly mcp ./my-tool.ts
  kly mcp user/weather-app
  kly install user/awesome-cli
  kly link ./my-tool
  kly list
  kly install --setup-path`);
}

function showVersion() {
  log.message(__VERSION__);
}

main()
  .then((exitCode) => {
    outro(`ヾ(￣▽￣)Bye~`);
    process.exit(exitCode ?? 0);
  })
  .catch((err) => {
    // Check for ExitWarning (user cancellation - graceful exit)
    const isExitWarning = err instanceof ExitWarning || err?.name === "ExitWarning";
    if (isExitWarning) {
      if (err.message) {
        cancel(err.message);
      }
      process.exit(0);
    }

    // Check for ExitError
    const isExitError = err instanceof ExitError || err?.name === "ExitError";
    const exitCode = isExitError ? (err.exitCode ?? 1) : 1;

    const message = typeof err === "string" ? err : err?.message || String(err);
    if (message) {
      error(message);
    }

    process.exit(exitCode);
  });
