import { join } from "node:path";
import { ENV_VARS } from "../shared/constants";
import { confirm } from "../ui";
import { checkCache, invalidateCache, writeMetadata } from "./cache";
import { cloneRepo, getCommitSha, installDependencies } from "./fetcher";
import { calculateRepoHash } from "./integrity";
import {
  getIntegrityHash,
  updateRepoRecord,
  updateSecurityInfo,
} from "./lockfile";
import { getRepoCachePath, parseRemoteRef } from "./parser";
import {
  checkEnvVars,
  readKlyConfig,
  resolveEntryPoint,
  validateVersion,
} from "./resolver";
import type { IntegrityCheckResult, RepoRef, RunRemoteOptions } from "./types";
import { checkForUpdates } from "./update-checker";

/** Current kly CLI version */
const KLY_VERSION = "0.1.0";

/**
 * Run a remote GitHub repository as a kly app
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

  // 2.5. Check for updates if cache is valid
  let needsUpdate = false;
  if (cacheResult.valid && !options.force && !options.skipUpdateCheck) {
    const updateResult = await checkForUpdates(ref, cacheResult.metadata!);

    if (updateResult.hasUpdate && updateResult.shouldUpdate) {
      // User chose to update
      needsUpdate = true;
      console.log(`Updating ${ref.owner}/${ref.repo}@${ref.ref}...`);
    } else if (updateResult.hasUpdate && !updateResult.shouldUpdate) {
      // User chose to use current version or cancelled
      if (updateResult.skipCheck === false) {
        // User explicitly cancelled - exit
        console.log("Cancelled");
        process.exit(0);
      }
      // Otherwise, continue with cached version
    }
  }

  if (!cacheResult.valid || options.force || needsUpdate) {
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

    // Update lockfile
    const url = `github.com/${ref.owner}/${ref.repo}@${ref.ref}`;
    updateRepoRecord(url, commitSha, true);

    console.log("Ready!\n");
  }

  // 7. Integrity verification
  if (!options.skipIntegrityCheck) {
    const integrityResult = await verifyIntegrity(ref, repoPath);

    if (!integrityResult.proceedWithExecution) {
      console.error(
        "\n❌ Execution cancelled due to integrity verification failure",
      );
      process.exit(1);
    }
  }

  // 8. Validate and execute
  await executeApp(ref, repoPath, options.args ?? [], options.mcp ?? false);
}

/**
 * Verify repository integrity using lockfile
 *
 * @param ref - Repository reference
 * @param repoPath - Local path to repository
 * @returns Object with integrity check result and whether to proceed with execution
 */
async function verifyIntegrity(
  ref: RepoRef,
  repoPath: string,
): Promise<{ proceedWithExecution: boolean; result: IntegrityCheckResult }> {
  const url = `github.com/${ref.owner}/${ref.repo}@${ref.ref}`;

  console.log("\n🔐 Verifying code integrity...");

  // Calculate repository hash
  const hash = calculateRepoHash(repoPath);
  console.log(`   Hash: ${hash.slice(0, 20)}...`);

  // Check against lockfile
  const existingHash = getIntegrityHash(url);

  // Determine verification result
  let verifyResult: "ok" | "mismatch" | "new";
  if (!existingHash) {
    verifyResult = "new";
  } else if (existingHash === hash) {
    verifyResult = "ok";
  } else {
    verifyResult = "mismatch";
  }

  const result: IntegrityCheckResult = {
    status: verifyResult,
    hash,
    requiresTrust: verifyResult !== "ok",
  };

  switch (verifyResult) {
    case "ok": {
      // Hash matches - code is trusted
      console.log("   ✓ Integrity verified\n");
      return { proceedWithExecution: true, result };
    }

    case "new": {
      // First time running this version
      console.log("\n⚠️  SECURITY NOTICE: First time running this tool\n");
      console.log("   This code has not been verified before.");
      console.log("   Please review the source code before proceeding:");
      console.log(
        `   https://github.com/${ref.owner}/${ref.repo}/tree/${ref.ref}\n`,
      );

      const shouldTrust = await confirm(
        "Do you trust this code and want to proceed?",
      );

      if (shouldTrust) {
        updateSecurityInfo(url, hash, true);
        console.log("   ✓ Code trusted and added to lockfile\n");
        return { proceedWithExecution: true, result };
      }

      console.log("\n   User declined to trust the code");
      return { proceedWithExecution: false, result };
    }

    case "mismatch": {
      // Hash doesn't match - code has changed!
      result.expectedHash = existingHash;

      console.log("\n🚨 SECURITY WARNING: Code has been modified!\n");
      console.log(
        "   The code for this tool has changed since you last ran it.",
      );
      console.log("   This could indicate:");
      console.log("   - A supply chain attack (code tampering)");
      console.log("   - Maintainer account compromise");
      console.log("   - Git history rewrite\n");

      console.log(
        "   Expected hash:",
        `${result.expectedHash?.slice(0, 40)}...`,
      );
      console.log("   Current hash: ", `${hash.slice(0, 40)}...\n`);

      console.log("   Recommended actions:");
      console.log("   1. Check GitHub for official announcements");
      console.log("   2. Contact the maintainer");
      console.log("   3. Review code changes carefully");
      console.log(
        `   4. Visit: https://github.com/${ref.owner}/${ref.repo}/commits/${ref.ref}\n`,
      );

      const shouldProceed = await confirm(
        "⚠️  Proceed anyway? (NOT RECOMMENDED)",
        false,
      );

      if (shouldProceed) {
        const shouldUpdate = await confirm(
          "Update lockfile with new hash?",
          false,
        );

        if (shouldUpdate) {
          updateSecurityInfo(url, hash, true);
          console.log("   ✓ Lockfile updated with new hash\n");
        }

        return { proceedWithExecution: true, result };
      }

      console.log("\n   Execution cancelled for safety");
      return { proceedWithExecution: false, result };
    }

    default: {
      // Should never reach here, but TypeScript requires it
      console.error("Unknown verification result");
      return { proceedWithExecution: false, result };
    }
  }
}

/**
 * Execute the kly app
 */
async function executeApp(
  ref: RepoRef,
  repoPath: string,
  args: string[],
  mcp: boolean,
): Promise<void> {
  // Read config and validate
  const config = readKlyConfig(repoPath);

  if (config?.version) {
    if (!validateVersion(config.version, KLY_VERSION)) {
      throw new Error(
        `This app requires kly ${config.version}, but you have ${KLY_VERSION}`,
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
    const { buildSandboxConfig, formatPermissionsSummary } = await import(
      "../permissions/config-builder"
    );
    const { extractAppPermissions } = await import("./permissions-extractor");

    const appId = getAppIdentifier();

    // Extract declared permissions from the app
    console.log("📋 Reading app permissions...");
    const declaredPermissions = await extractAppPermissions(absoluteEntryPath);

    // Show permission summary if declared
    if (declaredPermissions) {
      const summary = formatPermissionsSummary(declaredPermissions);
      if (summary.length > 0) {
        console.log("\nThis app requests the following permissions:");
        for (const item of summary) {
          console.log(item);
        }
        console.log("");
      }
    }

    // Check permissions based on what's declared
    console.log("🔐 Checking permissions...");

    let allowApiKey = false;
    let sandboxConfig:
      | import("@anthropic-ai/sandbox-runtime").SandboxRuntimeConfig
      | null = null;

    // Only ask for API key permission if the app declares it needs it
    if (declaredPermissions?.apiKeys) {
      allowApiKey = await checkApiKeyPermission(appId);

      if (!allowApiKey) {
        console.error("❌ Permission denied: API key access rejected");
        process.exit(1);
      }
    }

    // Build sandbox config from declared permissions, or ask interactively
    if (declaredPermissions) {
      // Use declared permissions to build sandbox config
      sandboxConfig = buildSandboxConfig(declaredPermissions);
    } else {
      // Fall back to interactive prompt if no permissions declared
      sandboxConfig = await getAppSandboxConfig(appId);

      if (!sandboxConfig) {
        console.error("❌ Permission denied: Sandbox configuration rejected");
        process.exit(1);
      }
    }

    // Ensure remote app directory is accessible in sandbox
    // This is needed for module resolution and file access
    if (!sandboxConfig.filesystem.allowWrite.includes(repoPath)) {
      sandboxConfig.filesystem.allowWrite.push(repoPath);
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
      invokeDir: process.cwd(), // Capture where kly run was invoked
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
  KlyConfig,
  RepoRef,
  RunRemoteOptions,
} from "./types";
