import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { select } from "../ui";
import { isTTY } from "../ui/utils/tty";

const CONFIG_DIR = join(homedir(), ".clai");
const PERMISSIONS_FILE = join(CONFIG_DIR, "permissions.json");

/**
 * Permission record for an app
 */
interface PermissionRecord {
  /** Whether the permission is granted */
  allowed: boolean;
  /** When the permission was granted or denied */
  timestamp: string;
  /** User's choice: "once", "always", or "deny" */
  choice: "once" | "always" | "deny";
}

/**
 * Permissions configuration
 */
interface PermissionsConfig {
  /** Trusted apps with their permissions */
  trustedApps: Record<string, PermissionRecord>;
}

/**
 * Get app identifier from script path
 */
export function getAppIdentifier(): string {
  const scriptPath = process.argv[1] ?? "";

  // Local file
  if (scriptPath.startsWith("/") || scriptPath.startsWith("C:\\")) {
    return `local:${scriptPath}`;
  }

  // Remote app (from environment variable set by remote loader)
  const remoteRef = process.env.CLAI_REMOTE_REF;
  if (remoteRef) {
    return remoteRef;
  }

  // Default to script path
  return scriptPath || "unknown";
}

/**
 * Get friendly app name for display
 */
export function getAppName(appId: string): string {
  if (appId.startsWith("local:")) {
    const path = appId.slice(6);
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  }

  if (appId.startsWith("github.com/")) {
    const parts = appId.split("/");
    return parts.slice(1, 3).join("/");
  }

  return appId;
}

/**
 * Ensure permissions config directory exists
 */
function ensurePermissionsDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load permissions configuration
 */
function loadPermissions(): PermissionsConfig {
  ensurePermissionsDir();

  if (!existsSync(PERMISSIONS_FILE)) {
    return { trustedApps: {} };
  }

  try {
    const content = readFileSync(PERMISSIONS_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse permissions file:", error);
    return { trustedApps: {} };
  }
}

/**
 * Save permissions configuration
 */
function savePermissions(config: PermissionsConfig): void {
  ensurePermissionsDir();
  writeFileSync(PERMISSIONS_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Check if environment variable allows bypassing permission check
 */
function shouldBypassPermissionCheck(): boolean {
  return process.env.CLAI_TRUST_ALL === "true";
}

/**
 * Request permission from user with interactive prompt
 */
async function requestPermission(
  appId: string,
  appName: string,
): Promise<boolean> {
  // Check if running in TTY mode
  if (!isTTY()) {
    console.error(
      `\nPermission required: App "${appName}" (${appId}) wants to access your API keys.`,
    );
    console.error(
      "Set CLAI_TRUST_ALL=true environment variable to grant access in non-interactive mode.",
    );
    return false;
  }

  console.log("");
  console.log(`App "${appName}" is requesting access to your API keys.`);
  console.log(`Source: ${appId}`);
  console.log("");
  console.log("This will allow the app to use your configured LLM models.");
  console.log("");

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
      { name: "Deny", value: "deny", description: "Reject the request" },
    ],
  });

  const config = loadPermissions();

  if (choice === "deny") {
    config.trustedApps[appId] = {
      allowed: false,
      timestamp: new Date().toISOString(),
      choice: "deny",
    };
    savePermissions(config);
    return false;
  }

  if (choice === "always") {
    config.trustedApps[appId] = {
      allowed: true,
      timestamp: new Date().toISOString(),
      choice: "always",
    };
    savePermissions(config);
    return true;
  }

  // "once" - don't save, just allow for this run
  return true;
}

/**
 * Check if an app has permission to access API keys
 * If not, prompt user for permission (in interactive mode)
 */
export async function checkApiKeyPermission(appId: string): Promise<boolean> {
  // Allow bypass via environment variable (for CI/automation)
  if (shouldBypassPermissionCheck()) {
    return true;
  }

  // Check stored permissions
  const config = loadPermissions();
  const record = config.trustedApps[appId];

  if (record) {
    if (record.choice === "always") {
      return record.allowed;
    }
    if (record.choice === "deny") {
      return false;
    }
  }

  // No stored permission or "once" - need to request
  const appName = getAppName(appId);
  return await requestPermission(appId, appName);
}

/**
 * Revoke permission for an app
 */
export function revokePermission(appId: string): void {
  const config = loadPermissions();
  delete config.trustedApps[appId];
  savePermissions(config);
}

/**
 * List all granted permissions
 */
export function listPermissions(): Array<{
  appId: string;
  appName: string;
  allowed: boolean;
  timestamp: string;
  choice: string;
}> {
  const config = loadPermissions();

  return Object.entries(config.trustedApps).map(([appId, record]) => ({
    appId,
    appName: getAppName(appId),
    allowed: record.allowed,
    timestamp: record.timestamp,
    choice: record.choice,
  }));
}
