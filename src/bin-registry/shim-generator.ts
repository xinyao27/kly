import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { log } from "../ui";
import type { BinRegistryEntry } from "./types";

export function getShimDir(): string {
  return join(homedir(), ".kly", "bin");
}

export function generateShimPath(commandName: string): string {
  return join(getShimDir(), commandName);
}

export function createShim(
  commandName: string,
  entry: BinRegistryEntry,
): string {
  const shimPath = generateShimPath(commandName);

  // Ensure directory exists
  mkdirSync(dirname(shimPath), { recursive: true });

  const shimContent = generateShimContent(commandName, entry);

  // Write shim file
  writeFileSync(shimPath, shimContent, "utf-8");

  // Make executable (chmod +x)
  try {
    chmodSync(shimPath, 0o755);
  } catch (error) {
    log.warn(`Failed to make shim executable: ${error}`);
  }

  return shimPath;
}

function generateShimContent(
  commandName: string,
  entry: BinRegistryEntry,
): string {
  const timestamp = new Date().toISOString();
  const sourceDisplay =
    entry.type === "remote" ? entry.remoteRef : entry.localPath;

  if (entry.type === "remote") {
    return `#!/usr/bin/env bun

// Auto-generated shim for kly-registered command
// DO NOT EDIT - This file is managed by kly
//
// Command: ${commandName}
// Source: ${sourceDisplay}
// Registered: ${timestamp}

import { spawn } from "node:child_process";

async function main() {
  const args = process.argv.slice(2);

  // Use kly run to ensure caching, updates, and integrity checks
  const klyArgs = ["run", "${entry.remoteRef}", "--", ...args];

  const kly = spawn("kly", klyArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  kly.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  kly.on("error", (err) => {
    console.error(\`Failed to execute kly: \${err.message}\`);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
  }

  return `#!/usr/bin/env bun

// Auto-generated shim for kly-registered command
// DO NOT EDIT - This file is managed by kly
//
// Command: ${commandName}
// Source: ${sourceDisplay}
// Registered: ${timestamp}

import { resolve } from "node:path";
import { spawn } from "node:child_process";

async function main() {
  const args = process.argv.slice(2);

  // Run directly from local source
  const sourcePath = "${entry.localPath}";
  const binPath = "${entry.binPath}";
  const absoluteBinPath = resolve(sourcePath, binPath);

  const proc = spawn("bun", ["run", absoluteBinPath, ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  proc.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  proc.on("error", (err) => {
    console.error(\`Failed to execute command: \${err.message}\`);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

export function removeShim(commandName: string): boolean {
  const shimPath = generateShimPath(commandName);

  try {
    if (existsSync(shimPath)) {
      rmSync(shimPath);
      return true;
    }
    return false;
  } catch (error) {
    log.warn(`Failed to remove shim: ${error}`);
    return false;
  }
}
