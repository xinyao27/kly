import { join } from "node:path";
import { ENV_VARS } from "../shared/constants";
import { checkCache, invalidateCache, writeMetadata } from "./cache";
import { cloneRepo, getCommitSha, installDependencies } from "./fetcher";
import { getRepoCachePath, parseRemoteRef } from "./parser";
import {
  checkEnvVars,
  readClaiConfig,
  resolveEntryPoint,
  validateVersion,
} from "./resolver";
import type { RepoRef, RunRemoteOptions } from "./types";

/** Current clai CLI version */
const CLAI_VERSION = "0.1.0";

/**
 * Run a remote GitHub repository as a clai app
 */
export async function runRemote(
  input: string,
  options: RunRemoteOptions = {},
): Promise<void> {
  // 1. Parse input
  const ref = parseRemoteRef(input);
  if (!ref) {
    throw new Error(`Invalid remote reference: ${input}`);
  }

  const repoPath = getRepoCachePath(ref);

  // 2. Check cache
  const cacheResult = checkCache(ref);

  if (!cacheResult.valid || options.force) {
    // 3. Clone repository
    if (options.force && cacheResult.exists) {
      console.log(`Refreshing ${ref.owner}/${ref.repo}@${ref.ref}...`);
      invalidateCache(ref);
    } else {
      console.log(`Fetching ${ref.owner}/${ref.repo}@${ref.ref}...`);
    }

    await cloneRepo(ref);

    // 4. Resolve entry point
    const entryPoint = resolveEntryPoint(repoPath);
    if (!entryPoint) {
      throw new Error(
        `No entry point found in ${ref.owner}/${ref.repo}. Set "main" in package.json or create index.ts`,
      );
    }

    // 5. Install dependencies
    if (!options.skipInstall) {
      console.log("Installing dependencies...");
      await installDependencies(repoPath);
    }

    // 6. Write metadata
    const commitSha = await getCommitSha(repoPath);
    writeMetadata(ref, {
      commitSha,
      cachedAt: new Date().toISOString(),
      entryPoint,
      dependenciesInstalled: !options.skipInstall,
    });

    console.log("Ready!\n");
  }

  // 7. Validate and execute
  await executeApp(ref, repoPath, options.args ?? [], options.mcp ?? false);
}

/**
 * Execute the clai app
 */
async function executeApp(
  ref: RepoRef,
  repoPath: string,
  args: string[],
  mcp: boolean,
): Promise<void> {
  // Read config and validate
  const config = readClaiConfig(repoPath);

  if (config?.version) {
    if (!validateVersion(config.version, CLAI_VERSION)) {
      throw new Error(
        `This app requires clai ${config.version}, but you have ${CLAI_VERSION}`,
      );
    }
  }

  // Check required env vars
  if (config?.env && config.env.length > 0) {
    const missing = checkEnvVars(config.env);
    if (missing.length > 0) {
      console.warn(
        `Warning: Required environment variables not set: ${missing.join(", ")}`,
      );
    }
  }

  // Resolve entry point
  const entryPoint = resolveEntryPoint(repoPath);
  if (!entryPoint) {
    throw new Error(`Cannot resolve entry point for ${ref.owner}/${ref.repo}`);
  }

  const absoluteEntryPath = join(repoPath, entryPoint);

  // Set remote ref environment variable for permission tracking
  const remoteRef = `github.com/${ref.owner}/${ref.repo}`;
  const prevRemoteRef = process.env[ENV_VARS.REMOTE_REF];
  process.env[ENV_VARS.REMOTE_REF] = remoteRef;

  try {
    // Dynamic imports to avoid circular dependencies
    const { getAppIdentifier, checkApiKeyPermission, getAppSandboxConfig } =
      await import("../permissions");
    const { launchSandbox } = await import("../host/launcher");

    const appId = getAppIdentifier();

    // Check permissions
    console.log("🔐 Checking permissions...");
    const allowApiKey = await checkApiKeyPermission(appId);

    if (!allowApiKey) {
      console.error("❌ Permission denied: API key access rejected");
      process.exit(1);
    }

    // Get sandbox configuration
    const sandboxConfig = await getAppSandboxConfig(appId);

    if (!sandboxConfig) {
      console.error("❌ Permission denied: Sandbox configuration rejected");
      process.exit(1);
    }

    // Handle MCP mode
    if (mcp) {
      // For MCP mode, we still need special handling
      // For now, just run directly without sandbox
      console.warn(
        "⚠️  MCP mode with remote repos not yet fully supported in new architecture",
      );
      process.env[ENV_VARS.MCP_MODE] = "true";
      process.argv = ["bun", absoluteEntryPath];
      await import(absoluteEntryPath);
      return;
    }

    // Launch in sandbox
    const result = await launchSandbox({
      scriptPath: absoluteEntryPath,
      args,
      appId,
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
    if (prevRemoteRef === undefined) {
      delete process.env[ENV_VARS.REMOTE_REF];
    } else {
      process.env[ENV_VARS.REMOTE_REF] = prevRemoteRef;
    }
  }
}

export { clearAllCache, invalidateCache } from "./cache";
// Re-export utilities
export { isRemoteRef, parseRemoteRef } from "./parser";
export type {
  CacheMetadata,
  ClaiConfig,
  RepoRef,
  RunRemoteOptions,
} from "./types";
