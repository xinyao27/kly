import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { ExitWarning } from "../shared/errors";
import { log } from "../ui";
import { detectBins, isCommandAvailable } from "./bin-detector";
import { addCommand, getCommand, removeCommand } from "./registry-manager";
import { createShim, removeShim } from "./shim-generator";
import type {
  BinDetectionResult,
  BinRegistryEntry,
  UnregisterOptions,
} from "./types";

/**
 * Calculate content hash for a project directory
 * Used to detect changes in local projects
 */
function calculateProjectHash(projectPath: string): string {
  const hash = createHash("sha256");

  // Hash package.json and main source files
  const files = [
    "package.json",
    "src", // Will recursively hash
    "bin",
  ];

  for (const file of files) {
    const filePath = join(projectPath, file);
    try {
      const stat = statSync(filePath);
      if (stat.isFile()) {
        const content = readFileSync(filePath);
        hash.update(content);
      } else if (stat.isDirectory()) {
        // Recursively hash directory contents
        const dirFiles = readdirSync(filePath, { recursive: true });
        for (const subFile of dirFiles) {
          const subPath = join(filePath, subFile as string);
          try {
            if (statSync(subPath).isFile()) {
              hash.update(readFileSync(subPath));
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Skip missing files
    }
  }

  return `sha256-${hash.digest("hex")}`;
}

/**
 * Auto-register bin commands from a project
 * Called after successful execution of a kly app
 */
export async function autoRegisterBins(
  projectPath: string,
  options: {
    type: "local" | "remote";
    remoteRef?: string;
    force?: boolean;
    skipConfirm?: boolean;
  },
): Promise<{ registered: string[]; skipped: string[]; errors: string[] }> {
  const detection = detectBins(projectPath);

  if (!detection.hasBin) {
    return { registered: [], skipped: [], errors: [] };
  }

  const binEntries = Object.entries(detection.bins);
  const registered: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Show what will be registered
  if (!options.skipConfirm) {
    log.info(`\nThis project provides ${binEntries.length} command(s):`);
    for (const [cmdName, binPath] of binEntries) {
      log.message(`  • ${cmdName} (${binPath})`);
    }

    const shouldRegister = await p.confirm({
      message: "Would you like to register these commands globally?",
    });

    if (p.isCancel(shouldRegister) || !shouldRegister) {
      return {
        registered: [],
        skipped: binEntries.map(([name]) => name),
        errors: [],
      };
    }
  }

  // Register each command
  for (const [commandName, binPath] of binEntries) {
    try {
      await registerSingleCommand(commandName, {
        projectPath,
        binPath,
        detection,
        ...options,
      });
      registered.push(commandName);
      log.success(`Registered: ${commandName}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${commandName}: ${errorMsg}`);
      log.warn(`Failed to register ${commandName}: ${errorMsg}`);
    }
  }

  if (registered.length > 0) {
    log.info("\nCommands are now available globally!");
    log.message("Make sure ~/.kly/bin is in your PATH.");
    log.message("Run 'kly install --setup-path' to configure automatically.");
  }

  return { registered, skipped, errors };
}

async function registerSingleCommand(
  commandName: string,
  options: {
    projectPath: string;
    binPath: string;
    detection: BinDetectionResult;
    type: "local" | "remote";
    remoteRef?: string;
    force?: boolean;
  },
): Promise<void> {
  const { projectPath, binPath, detection, type, remoteRef, force } = options;

  // Check if command already exists
  const existing = getCommand(commandName);

  if (existing && !force) {
    // Check if it's the same project (update scenario)
    const isSameProject =
      (type === "local" && existing.localPath === projectPath) ||
      (type === "remote" && existing.remoteRef === remoteRef);

    if (isSameProject) {
      // Update existing registration
      log.step(`Updating registration for ${commandName}`);
    } else {
      // Conflict with different project
      const shouldOverride = await p.confirm({
        message: `Command '${commandName}' is already registered by ${existing.projectName}. Override?`,
        initialValue: false,
      });

      if (p.isCancel(shouldOverride) || !shouldOverride) {
        throw new ExitWarning("Registration cancelled");
      }
    }
  }

  // Check if command exists in system (not from kly)
  if (!existing && isCommandAvailable(commandName)) {
    log.warn(`Warning: '${commandName}' already exists in your system`);
    const shouldContinue = await p.confirm({
      message: "This may shadow the existing command. Continue?",
      initialValue: false,
    });

    if (p.isCancel(shouldContinue) || !shouldContinue) {
      throw new ExitWarning("Registration cancelled");
    }
  }

  // Calculate content hash (for local projects)
  const contentHash =
    type === "local" ? calculateProjectHash(projectPath) : null;

  // Create registry entry
  const entry: BinRegistryEntry = {
    type,
    remoteRef: type === "remote" ? remoteRef! : null,
    localPath: type === "local" ? projectPath : null,
    binPath,
    shimPath: "", // Will be set after shim creation
    projectName: detection.projectName,
    projectVersion: detection.projectVersion,
    registeredAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    contentHash,
  };

  // Create shim script
  const shimPath = createShim(commandName, entry);
  entry.shimPath = shimPath;

  // Save to registry
  addCommand(commandName, entry);
}

/**
 * Unregister a command
 */
export async function unregisterCommand(
  commandName: string,
  options: UnregisterOptions = {},
): Promise<boolean> {
  const existing = getCommand(commandName);

  if (!existing && !options.force) {
    log.warn(`Command '${commandName}' is not registered`);
    return false;
  }

  if (!options.skipConfirm && existing) {
    const shouldUnregister = await p.confirm({
      message: `Unregister '${commandName}' from ${existing.projectName}?`,
    });

    if (p.isCancel(shouldUnregister) || !shouldUnregister) {
      log.message("Cancelled");
      return false;
    }
  }

  // Remove shim
  removeShim(commandName);

  // Remove from registry
  removeCommand(commandName);

  log.success(`Unregistered: ${commandName}`);
  return true;
}

/**
 * Check if local project needs re-registration (content changed)
 */
export function shouldReregisterLocal(
  commandName: string,
  projectPath: string,
): boolean {
  const existing = getCommand(commandName);

  if (!existing || existing.type !== "local") {
    return false;
  }

  if (existing.localPath !== projectPath) {
    return false;
  }

  const currentHash = calculateProjectHash(projectPath);
  return currentHash !== existing.contentHash;
}
