import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import { PATHS } from "../shared/constants";
import { getLocalRef, getRemoteRef, isTrustAll } from "../shared/runtime-mode";
import { error, log, output, select } from "../ui";
import { isTTY } from "../ui/utils/tty";

const CONFIG_DIR = join(homedir(), PATHS.CONFIG_DIR);
const PERMISSIONS_FILE = join(CONFIG_DIR, PATHS.PERMISSIONS_FILE);

/**
 * Permission record for an app
 * Only "always" choices are stored
 */
interface PermissionRecord {
  /** When the permission was granted */
  timestamp: string;
  /** User's choice: always "always" (only stored choice) */
  choice: "always";
  /** Sandbox configuration (optional, for sandboxed execution) */
  sandboxConfig?: SandboxRuntimeConfig;
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
  // Check for explicit local file reference (set by kly run command)
  const localRef = getLocalRef();
  if (localRef) {
    return localRef;
  }

  // Remote app (from environment variable set by remote loader)
  const remoteRef = getRemoteRef();
  if (remoteRef) {
    return remoteRef;
  }

  // Fallback to script path for direct execution
  const scriptPath = process.argv[1] ?? "";
  if (scriptPath.startsWith("/") || scriptPath.startsWith("C:\\")) {
    return `local:${scriptPath}`;
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
export function loadPermissions(): PermissionsConfig {
  ensurePermissionsDir();

  if (!existsSync(PERMISSIONS_FILE)) {
    return { trustedApps: {} };
  }

  try {
    const content = readFileSync(PERMISSIONS_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    error(`Failed to parse permissions file: ${err}`);
    return { trustedApps: {} };
  }
}

/**
 * Save permissions configuration
 */
export function savePermissions(config: PermissionsConfig): void {
  ensurePermissionsDir();
  writeFileSync(PERMISSIONS_FILE, JSON.stringify(config, null, 2), "utf-8");
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
    error(
      `Permission required: App "${appName}" (${appId}) wants to access your API keys.`,
    );
    error(
      "Set KLY_TRUST_ALL=true environment variable to grant access in non-interactive mode.",
    );
    return false;
  }

  output(`App "${appName}" is requesting access to your API keys.`);
  output(`Source: ${appId}`);
  output("This will allow the app to use your configured LLM models.");

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
      { name: "Cancel", value: "cancel", description: "Cancel and exit" },
    ],
  });

  // Cancel - don't save, just reject
  if (choice === "cancel") {
    return false;
  }

  // Always - save to config
  if (choice === "always") {
    const config = loadPermissions();
    config.trustedApps[appId] = {
      timestamp: new Date().toISOString(),
      choice: "always",
    };
    savePermissions(config);
    return true;
  }

  // Once - don't save, just allow for this run
  return true;
}

/**
 * Check if an app has permission to access API keys
 * If not, prompt user for permission (in interactive mode)
 */
export async function checkApiKeyPermission(appId: string): Promise<boolean> {
  // Allow bypass via environment variable (for CI/automation)
  if (isTrustAll()) {
    return true;
  }

  // Check stored permissions
  const config = loadPermissions();
  const record = config.trustedApps[appId];

  // If record exists, it's always "always allow" (we only store grants)
  if (record && record.choice === "always") {
    return true;
  }

  // No stored permission - need to request
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
 * Only "always allow" permissions are stored
 */
export function listPermissions(): Array<{
  appId: string;
  appName: string;
  timestamp: string;
  choice: string;
}> {
  const config = loadPermissions();

  return Object.entries(config.trustedApps).map(([appId, record]) => ({
    appId,
    appName: getAppName(appId),
    timestamp: record.timestamp,
    choice: record.choice,
  }));
}

/**
 * Request sandbox configuration from user interactively
 * Returns SandboxRuntimeConfig directly (no conversion needed)
 */
async function requestSandboxConfig(
  appId: string,
  appName: string,
): Promise<SandboxRuntimeConfig | null> {
  if (!isTTY()) {
    error(`Sandbox permission required for: "${appName}" (${appId})`);
    error(
      "Set KLY_TRUST_ALL=true environment variable to run without sandboxing in non-interactive mode.",
    );
    return null;
  }

  const homeDir = homedir();
  const currentDir = process.cwd();

  output(`🔐 Sandbox Permission Request from: ${appName}`);

  // Ask for filesystem read permissions
  output("📂 Filesystem Read Access:");
  const fsReadChoice = await select({
    prompt: "Which files should be denied for reading?",
    options: [
      {
        name: "Sensitive only",
        value: "sensitive",
        description: "Deny access to ~/.kly, ~/.ssh, ~/.aws, etc.",
      },
      {
        name: "All home directory",
        value: "all-home",
        description: "Deny access to entire home directory",
      },
      {
        name: "None (allow all)",
        value: "none",
        description: "No read restrictions (except ~/.kly)",
      },
    ],
  });

  // Always deny reading sensitive directories (hardcoded for security)
  let denyRead: string[] = [join(homeDir, ".kly")];

  if (fsReadChoice === "sensitive") {
    denyRead = [
      join(homeDir, ".kly"),
      join(homeDir, ".ssh"),
      join(homeDir, ".aws"),
      join(homeDir, ".gnupg"),
    ];
  } else if (fsReadChoice === "all-home") {
    denyRead = [homeDir];
  }
  // Note: Even if user chooses "none", .kly is still protected

  // Ask for filesystem write permissions
  output("📝 Filesystem Write Access:");
  const fsWriteChoice = await select({
    prompt: "Which directories should be allowed for writing?",
    options: [
      {
        name: "None",
        value: "none",
        description: "No write access",
      },
      {
        name: "Current directory only",
        value: "current",
        description: `Allow write to ${currentDir}`,
      },
      {
        name: "Temporary directory",
        value: "temp",
        description: "Allow write to system temp directory",
      },
    ],
  });

  let allowWrite: string[] = [];
  if (fsWriteChoice === "current") {
    allowWrite = [currentDir];
  } else if (fsWriteChoice === "temp") {
    const tmpdir = process.env.TMPDIR || process.env.TEMP || "/tmp";
    allowWrite = [tmpdir];
  }

  // Always deny writing to sensitive directories (hardcoded for security)
  const denyWrite = [
    join(homeDir, ".kly"), // KLY config and permissions
    join(homeDir, ".ssh"), // SSH keys
    join(homeDir, ".aws"), // AWS credentials
    join(homeDir, ".gnupg"), // GPG keys
  ];

  // Ask for network permissions
  output("🌐 Network Access:");
  const networkChoice = await select({
    prompt: "Which network access should be allowed?",
    options: [
      {
        name: "None",
        value: "none",
        description: "No network access",
      },
      {
        name: "LLM APIs only",
        value: "llm-apis",
        description: "OpenAI, Anthropic, Google AI",
      },
      {
        name: "Common APIs",
        value: "common",
        description: "LLM + GitHub, npm, etc.",
      },
      {
        name: "All domains",
        value: "all",
        description: "Allow all network access",
      },
    ],
  });

  let allowedDomains: string[] = [];
  if (networkChoice === "llm-apis") {
    allowedDomains = [
      "api.openai.com",
      "*.anthropic.com",
      "generativelanguage.googleapis.com",
    ];
  } else if (networkChoice === "common") {
    allowedDomains = [
      "api.openai.com",
      "*.anthropic.com",
      "generativelanguage.googleapis.com",
      "*.github.com",
      "registry.npmjs.org",
    ];
  } else if (networkChoice === "all") {
    allowedDomains = ["*"];
  }

  // Ask how long to remember this choice
  const duration = await select({
    prompt: "How long should these permissions last?",
    options: [
      {
        name: "One time only",
        value: "once",
        description: "Ask again next time",
      },
      {
        name: "Always allow",
        value: "always",
        description: "Remember for this app",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Cancel and exit",
      },
    ],
  });

  // Cancel - don't save, just reject
  if (duration === "cancel") {
    return null;
  }

  // Construct SandboxRuntimeConfig directly
  const sandboxConfig: SandboxRuntimeConfig = {
    network: {
      allowedDomains,
      deniedDomains: [],
    },
    filesystem: {
      denyRead,
      allowWrite,
      denyWrite,
    },
  };

  // Save permission record only if "always"
  if (duration === "always") {
    const config = loadPermissions();
    config.trustedApps[appId] = {
      sandboxConfig,
      timestamp: new Date().toISOString(),
      choice: "always",
    };
    savePermissions(config);
  }

  log.success("Sandbox permissions granted!");
  return sandboxConfig;
}

/**
 * Get sandbox configuration for an app
 * Returns SandboxRuntimeConfig directly (no conversion needed)
 *
 * @param appId - App identifier
 * @returns SandboxRuntimeConfig or null if denied
 */
export async function getAppSandboxConfig(
  appId: string,
): Promise<SandboxRuntimeConfig | null> {
  const homeDir = homedir();

  // Check for trust-all bypass (for automation)
  if (isTrustAll()) {
    // Even in trust-all mode, protect sensitive directories
    return {
      network: { allowedDomains: ["*"], deniedDomains: [] },
      filesystem: {
        denyRead: [join(homeDir, ".kly")], // ALWAYS deny reading KLY config
        allowWrite: ["*"],
        denyWrite: [
          join(homeDir, ".kly"), // KLY config and permissions
          join(homeDir, ".ssh"), // SSH keys
          join(homeDir, ".aws"), // AWS credentials
          join(homeDir, ".gnupg"), // GPG keys
        ],
      },
    };
  }

  const config = loadPermissions();
  const record = config.trustedApps[appId];

  // If permission already granted as "always", return cached config
  if (record?.choice === "always" && record.sandboxConfig) {
    return record.sandboxConfig;
  }

  // Request new sandbox permissions
  const appName = getAppName(appId);
  return await requestSandboxConfig(appId, appName);
}

/**
 * Clear all permissions
 */
export function clearAllPermissions(): void {
  savePermissions({ trustedApps: {} });
}
