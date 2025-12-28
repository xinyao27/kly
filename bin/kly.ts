#!/usr/bin/env bun
import { resolve } from "node:path";
import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import * as p from "@clack/prompts";
import { modelsCommand } from "../src/ai/models-command";
import { launchSandbox } from "../src/host/launcher";
import { getAppIdentifier } from "../src/permissions";
import { permissionsCommand } from "../src/permissions/cli";
import { buildSandboxConfig } from "../src/permissions/config-builder";
import { extractAppPermissions } from "../src/permissions/extract";
import {
  checkStoredPermission,
  requestUnifiedPermission,
} from "../src/permissions/unified-prompt";
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

  if (command === "models") {
    await modelsCommand();
    return;
  }

  if (command === "permissions") {
    await permissionsCommand();
    return;
  }

  if (command === "run") {
    const target = args[1];
    if (!target) {
      console.error("Error: Missing file path or remote reference");
      console.error("Usage: kly run <file|user/repo[@ref]>");
      process.exit(1);
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
        : args
            .slice(2)
            .filter((arg) => arg !== "--force" && arg !== "--no-update-check");

    if (isRemoteRef(target)) {
      await runRemote(target, { args: appArgs, force, skipUpdateCheck });
    } else {
      await runFile(target, appArgs);
    }
    return;
  }

  if (command === "mcp") {
    const target = args[1];
    if (!target) {
      console.error("Error: Missing file path or remote reference");
      console.error("Usage: kly mcp <file|user/repo[@ref]>");
      process.exit(1);
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
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error('Run "kly --help" for usage');
  process.exit(1);
}

async function runFile(filePath: string, appArgs: string[]) {
  const absolutePath = resolve(process.cwd(), filePath);
  // Capture the working directory where kly run was invoked
  const invokeDir = process.cwd();

  // Set local file identifier for permission tracking
  const prevLocalRef = process.env.KLY_LOCAL_REF;
  process.env.KLY_LOCAL_REF = `local:${absolutePath}`;

  try {
    // Get app identifier
    const appId = getAppIdentifier();

    // Check if permission already granted
    const storedConfig = checkStoredPermission(appId);
    let sandboxConfig: SandboxRuntimeConfig;
    let allowApiKey = false;

    if (!storedConfig) {
      // Extract declared permissions from app
      const appPermissions = await extractAppPermissions(absolutePath);

      // Build complete sandbox config (with auto-LLM domains if apiKeys: true)
      sandboxConfig = buildSandboxConfig(appPermissions);

      // Show unified permission prompt
      const allowed = await requestUnifiedPermission(
        appId,
        appPermissions,
        sandboxConfig,
      );

      if (!allowed) {
        console.error("❌ Permission denied");
        process.exit(1);
      }

      // Set API key access based on declared permissions
      allowApiKey = appPermissions?.apiKeys ?? false;
    } else {
      // Permission already granted, use stored config
      sandboxConfig = storedConfig;
      // We need to re-extract to determine if apiKeys was requested
      const appPermissions = await extractAppPermissions(absolutePath);
      allowApiKey = appPermissions?.apiKeys ?? false;
    }

    // Launch in sandbox
    const result = await launchSandbox({
      scriptPath: absolutePath,
      args: appArgs,
      appId,
      invokeDir,
      sandboxConfig,
      allowApiKey,
    });

    if (result.error) {
      console.error(`\n❌ Error: ${result.error}`);
    }

    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }
  } finally {
    // Restore environment
    if (prevLocalRef === undefined) {
      delete process.env.KLY_LOCAL_REF;
    } else {
      process.env.KLY_LOCAL_REF = prevLocalRef;
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
  console.log(`
kly - Command Line AI

Usage:
  kly <command> [options]

Commands:
  models         Manage LLM model configurations
  permissions    Manage app permissions
  run <target>   Run a Kly app
  mcp <target>   Start an MCP server for a Kly app

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
  kly permissions
  kly run ./my-tool.ts
  kly run ./my-tool.ts --name=World
  kly run user/weather-app
  kly run user/weather-app@v1.0.0
  kly run user/weather-app -- --city=Beijing
  kly mcp ./my-tool.ts
  kly mcp user/weather-app
`);
}

function showVersion() {
  p.log.message(__VERSION__);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
