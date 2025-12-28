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
 * Build a complete SandboxRuntimeConfig from declared app permissions
 *
 * This merges:
 * 1. Default safe configuration
 * 2. Automatic LLM domains (if apiKeys: true)
 * 3. User-declared sandbox config
 * 4. Mandatory protections (always applied)
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
      allowedDomains = [
        ...allowedDomains,
        ...userSandbox.network.allowedDomains,
      ];
    }

    // Merge filesystem config
    if (userSandbox.filesystem) {
      if (userSandbox.filesystem.allowWrite) {
        // Replace default with user's choice
        allowWrite = userSandbox.filesystem.allowWrite;
      }

      if (userSandbox.filesystem.denyRead) {
        // Add user's deny list
        denyRead = [...denyRead, ...userSandbox.filesystem.denyRead];
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

  // Show custom filesystem read restrictions if declared
  if (permissions?.sandbox?.filesystem?.denyRead) {
    summary.push(
      `• Filesystem read denied: ${permissions.sandbox.filesystem.denyRead.length} path(s)`,
    );
  }

  return summary;
}
