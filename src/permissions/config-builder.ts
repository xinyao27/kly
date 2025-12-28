import { homedir } from "node:os";
import { join } from "node:path";
import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import { LLM_API_DOMAINS } from "../shared/constants";
import type { AppPermissions } from "../types";

/**
 * Always protected paths (never allow write, some deny read)
 */
const PROTECTED_PATHS = {
  alwaysDenyWrite: [
    join(homedir(), ".kly"), // KLY config and permissions
    join(homedir(), ".ssh"), // SSH keys
    join(homedir(), ".aws"), // AWS credentials
    join(homedir(), ".gnupg"), // GPG keys
  ],
  alwaysDenyRead: [
    join(homedir(), ".kly"), // KLY config (prevent reading permissions.json)
  ],
};

/**
 * Resolve filesystem path with special marker support
 *
 * Special markers:
 * - "*": User's home directory (allows access to all non-sensitive files)
 * - Absolute paths: Used as-is
 *
 * @param path - Path to resolve (may contain special markers)
 * @returns Resolved absolute path, or undefined if path is undefined
 */
function resolveFilesystemPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path === "*") {
    // Allow access to user's home directory (sensitive paths are always protected)
    return homedir();
  }
  return path;
}

/**
 * Build a complete SandboxRuntimeConfig from declared app permissions
 *
 * This merges:
 * 1. Default safe configuration
 * 2. Automatic LLM domains (if apiKeys: true)
 * 3. User-declared sandbox config (with special marker support)
 * 4. Mandatory protections (always applied)
 *
 * Special markers in filesystem paths:
 * - "*": Allows access to all files in user's home directory (except sensitive paths)
 *
 * @param permissions - Declared app permissions
 * @returns Complete sandbox configuration ready for SandboxManager
 */
export function buildSandboxConfig(
  permissions: AppPermissions | undefined,
): SandboxRuntimeConfig {
  const currentDir = process.cwd();

  // Start with defaults
  let allowedDomains: string[] = [];
  let allowWrite: string[] = [currentDir]; // Allow current directory by default
  let denyRead: string[] = [...PROTECTED_PATHS.alwaysDenyRead];

  // If apiKeys requested, add LLM domains automatically
  if (permissions?.apiKeys) {
    allowedDomains = [...LLM_API_DOMAINS];
  }

  // Merge user-declared sandbox config
  if (permissions?.sandbox) {
    const userSandbox = permissions.sandbox;

    // Merge network config
    if (userSandbox.network?.allowedDomains) {
      const domains = userSandbox.network.allowedDomains.filter(
        (d): d is string => d !== undefined,
      );
      allowedDomains = [...allowedDomains, ...domains];
    }

    // Merge filesystem config
    if (userSandbox.filesystem) {
      if (userSandbox.filesystem.allowWrite) {
        // Replace default with user's choice, resolving special markers
        allowWrite = userSandbox.filesystem.allowWrite
          .map(resolveFilesystemPath)
          .filter((p): p is string => p !== undefined);
      }

      if (userSandbox.filesystem.denyRead) {
        // Add user's deny list, resolving special markers
        const deniedPaths = userSandbox.filesystem.denyRead
          .map(resolveFilesystemPath)
          .filter((p): p is string => p !== undefined);
        denyRead = [...denyRead, ...deniedPaths];
      }
    }
  }

  // Build final config
  const config: SandboxRuntimeConfig = {
    network: {
      allowedDomains,
      deniedDomains: [],
    },
    filesystem: {
      denyRead,
      allowWrite,
      denyWrite: PROTECTED_PATHS.alwaysDenyWrite, // Always protected
    },
  };

  return config;
}

/**
 * Get a human-readable summary of permissions for display
 * Only shows special/non-default permissions
 */
export function formatPermissionsSummary(
  permissions: AppPermissions | undefined,
): string[] {
  const summary: string[] = [];

  // Always show API Keys if requested (special permission)
  if (permissions?.apiKeys) {
    summary.push("• API Keys access (to call LLM APIs)");
  }

  const config = buildSandboxConfig(permissions);
  const currentDir = process.cwd();

  // Network - only show if non-default (not empty)
  if (config.network.allowedDomains.length > 0) {
    if (config.network.allowedDomains.includes("*")) {
      summary.push("• Network: All domains");
    } else {
      const domains = config.network.allowedDomains.slice(0, 3).join(", ");
      const more =
        config.network.allowedDomains.length > 3
          ? ` +${config.network.allowedDomains.length - 3} more`
          : "";
      summary.push(`• Network: ${domains}${more}`);
    }
  }

  // Filesystem - only show if custom (not just current directory)
  const hasCustomWrite =
    config.filesystem.allowWrite.length > 1 ||
    (config.filesystem.allowWrite.length === 1 &&
      config.filesystem.allowWrite[0] !== currentDir);

  if (hasCustomWrite) {
    // Check if home directory is allowed (via "*" marker)
    const homeDir = homedir();
    const allowsHomeDir = config.filesystem.allowWrite.includes(homeDir);

    if (allowsHomeDir) {
      summary.push("• Filesystem write: All non-sensitive directories");
    } else {
      const dirs = config.filesystem.allowWrite
        .map((p) => (p === currentDir ? "current directory" : p))
        .slice(0, 2)
        .join(", ");
      const more =
        config.filesystem.allowWrite.length > 2
          ? ` +${config.filesystem.allowWrite.length - 2} more`
          : "";
      summary.push(`• Filesystem write: ${dirs}${more}`);
    }
  }

  // Show custom filesystem read restrictions if declared
  if (permissions?.sandbox?.filesystem?.denyRead) {
    summary.push(
      `• Filesystem read denied: ${permissions.sandbox.filesystem.denyRead.length} path(s)`,
    );
  }

  return summary;
}
