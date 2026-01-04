import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import { isTrustAll } from "../shared/runtime-mode";
import type { AppPermissions } from "../types";
import { error, output, select } from "../ui";
import { isTTY } from "../ui/utils/tty";
import { formatPermissionsSummary } from "./config-builder";
import { getAppName, loadPermissions, savePermissions } from "./index";

/**
 * Check if permissions require user prompt
 * Only prompt for special permissions (API keys, custom network/filesystem)
 * Default permissions (current directory write, no network) are auto-granted
 */
function needsPermissionPrompt(
  permissions: AppPermissions | undefined,
  sandboxConfig: SandboxRuntimeConfig,
): boolean {
  // If API keys requested, always prompt
  if (permissions?.apiKeys) {
    return true;
  }

  // If custom network access requested, prompt
  // undefined allowedDomains means "allow all" (requires prompt)
  // empty array means "block all" (default, no prompt needed)
  const allowedDomains = sandboxConfig.network.allowedDomains;
  if (allowedDomains === undefined || allowedDomains.length > 0) {
    return true;
  }

  // If custom filesystem permissions declared, prompt
  if (permissions?.sandbox?.filesystem) {
    return true;
  }

  // Otherwise, use default permissions silently
  return false;
}

/**
 * Request permission with a single unified prompt
 * Shows all requested permissions at once
 *
 * @param appId - App identifier
 * @param appPermissions - Declared permissions from app
 * @param sandboxConfig - Generated sandbox configuration
 * @returns true if allowed, false if cancelled
 */
export async function requestUnifiedPermission(
  appId: string,
  appPermissions: AppPermissions | undefined,
  sandboxConfig: SandboxRuntimeConfig,
): Promise<boolean> {
  // Check for bypass
  if (isTrustAll()) {
    return true;
  }

  // Check stored permissions
  const config = loadPermissions();
  const record = config.trustedApps[appId];

  if (record && record.choice === "always") {
    // Already granted
    return true;
  }

  // Check if this app needs permission prompt
  // Default permissions (current dir write, no network) don't need prompt
  if (!needsPermissionPrompt(appPermissions, sandboxConfig)) {
    return true; // Auto-grant default permissions
  }

  // Check if running in TTY mode
  if (!isTTY()) {
    const appName = getAppName(appId);
    error(
      `Permission required: App "${appName}" (${appId}) requests permissions.`,
    );
    error(
      "Set KLY_TRUST_ALL=true environment variable to grant access in non-interactive mode.",
    );
    return false;
  }

  // Show unified prompt
  const appName = getAppName(appId);
  output(`App "${appName}" requests the following permissions:`);

  // Format and display permissions
  const summary = formatPermissionsSummary(appPermissions);
  for (const line of summary) {
    output(`  ${line}`);
  }

  output(`Source: ${appId}`);

  // Ask user
  const choice = await select({
    prompt: "Do you want to allow this?",
    options: [
      {
        name: "Allow once",
        value: "once",
        description: "Allow for this session only",
      },
      {
        name: "Always allow",
        value: "always",
        description: "Remember this choice for future runs",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Cancel and exit",
      },
    ],
  });

  // Handle choice
  if (choice === "cancel") {
    return false;
  }

  if (choice === "always") {
    // Save permission
    config.trustedApps[appId] = {
      timestamp: new Date().toISOString(),
      choice: "always",
      sandboxConfig,
    };
    savePermissions(config);
  }

  // "once" or "always" - both allow execution
  return true;
}

/**
 * Check if app needs permission check
 * Returns stored sandbox config if "always" was granted
 */
export function checkStoredPermission(
  appId: string,
): SandboxRuntimeConfig | null {
  if (isTrustAll()) {
    return null; // Will use default config
  }

  const config = loadPermissions();
  const record = config.trustedApps[appId];

  if (record?.choice === "always" && record.sandboxConfig) {
    return record.sandboxConfig;
  }

  return null;
}
