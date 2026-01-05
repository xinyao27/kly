import { join } from "node:path";
import { ENV_VARS } from "../shared/constants";
import { ExitError, ExitWarning } from "../shared/errors";
import { confirm, error, log, output } from "../ui";
import { checkCache, invalidateCache, writeMetadata } from "./cache";
import { cloneRepo, getCommitSha, installDependencies } from "./fetcher";
import { calculateRepoHash } from "./integrity";
import { getIntegrityHash, updateRepoRecord, updateSecurityInfo } from "./lockfile";
import { getRepoCachePath, parseRemoteRef } from "./parser";
import { checkEnvVars, readKlyConfig, resolveEntryPoint, validateVersion } from "./resolver";
import type { IntegrityCheckResult, RepoRef, RunRemoteOptions } from "./types";
import { checkForUpdates } from "./update-checker";

/** Current kly CLI version */
const KLY_VERSION = __VERSION__;

/**
 * Run a remote GitHub repository as a kly app
 */
export async function runRemote(input: string, options: RunRemoteOptions = {}): Promise<void> {
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
      log.step(`Updating ${ref.owner}/${ref.repo}@${ref.ref}...`);
    } else if (updateResult.hasUpdate && !updateResult.shouldUpdate) {
      // User chose to use current version or cancelled
      if (updateResult.skipCheck === false) {
        // User explicitly cancelled - exit
        throw new ExitWarning("Cancelled");
      }
      // Otherwise, continue with cached version
    }
  }

  if (!cacheResult.valid || options.force || needsUpdate) {
    // 3. Clone repository
    if (options.force && cacheResult.exists) {
      log.step(`Refreshing ${ref.owner}/${ref.repo}@${ref.ref}...`);
      invalidateCache(ref);
    } else {
      log.step(`Fetching ${ref.owner}/${ref.repo}@${ref.ref}...`);
    }

    await cloneRepo(ref);

    // 4. Resolve entry point
    const entryPoint = resolveEntryPoint(repoPath, ref.subpath);
    if (!entryPoint) {
      throw new Error(
        `No entry point found in ${ref.provider}:${ref.owner}/${ref.repo}${ref.subpath ? `/${ref.subpath}` : ""}. Set "main" in package.json or create index.ts`,
      );
    }

    // 5. Install dependencies
    if (!options.skipInstall) {
      log.step("Installing dependencies...");
      await installDependencies(repoPath);
    }

    // 5.5. Auto-register bin commands (if any)
    if (!options.skipRegister) {
      const { autoRegisterBins } = await import("../bin-registry");
      await autoRegisterBins(repoPath, {
        type: "remote",
        remoteRef: formatRepoUrl(ref),
        skipConfirm: false, // Always ask for remote projects
      });
    }

    // 6. Write metadata
    const commitSha = await getCommitSha(repoPath);
    writeMetadata(ref, {
      commitSha,
      cachedAt: new Date().toISOString(),
      entryPoint,
      dependenciesInstalled: !options.skipInstall,
    });

    // Update lockfile (use consistent URL format)
    const url = formatRepoUrl(ref);
    updateRepoRecord(url, commitSha, true);

    log.success("Ready!");
  }

  // 7. Integrity verification
  if (!options.skipIntegrityCheck) {
    const integrityResult = await verifyIntegrity(ref, repoPath);

    if (!integrityResult.proceedWithExecution) {
      throw new ExitError("Execution cancelled due to integrity verification failure");
    }
  }

  // 8. Validate and execute
  await executeApp(ref, repoPath, options.args ?? [], options.mcp ?? false);
}

/**
 * Provider to domain mapping
 */
const PROVIDER_DOMAINS: Record<RepoRef["provider"], string> = {
  github: "github.com",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
  sourcehut: "sr.ht",
};

/**
 * Format a repository reference as a URL string for lockfile
 */
function formatRepoUrl(ref: RepoRef): string {
  const domain = PROVIDER_DOMAINS[ref.provider];
  const base = `${domain}/${ref.owner}/${ref.repo}@${ref.ref}`;
  return ref.subpath ? `${base}/${ref.subpath}` : base;
}

/**
 * Get the web URL for a repository (for viewing in browser)
 */
function getRepoWebUrl(ref: RepoRef, path: "tree" | "commits" = "tree"): string {
  switch (ref.provider) {
    case "github":
      return `https://github.com/${ref.owner}/${ref.repo}/${path}/${ref.ref}`;
    case "gitlab":
      return `https://gitlab.com/${ref.owner}/${ref.repo}/-/${path}/${ref.ref}`;
    case "bitbucket":
      return `https://bitbucket.org/${ref.owner}/${ref.repo}/src/${ref.ref}`;
    case "sourcehut":
      return `https://git.sr.ht/~${ref.owner}/${ref.repo}/tree/${ref.ref}`;
  }
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
  const url = formatRepoUrl(ref);

  log.step("Verifying code integrity...");

  // Calculate repository hash
  const hash = calculateRepoHash(repoPath);
  output(`Hash: ${hash.slice(0, 20)}...`);

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
      log.success("Integrity verified");
      return { proceedWithExecution: true, result };
    }

    case "new": {
      // First time running this version
      log.warn("SECURITY NOTICE: First time running this tool");
      output("This code has not been verified before.");
      output("Please review the source code before proceeding:");
      output(getRepoWebUrl(ref));

      const shouldTrust = await confirm("Do you trust this code and want to proceed?");

      if (shouldTrust) {
        updateSecurityInfo(url, hash, true);
        log.success("Code trusted and added to lockfile");
        return { proceedWithExecution: true, result };
      }

      output("User declined to trust the code");
      return { proceedWithExecution: false, result };
    }

    case "mismatch": {
      // Hash doesn't match - code has changed!
      result.expectedHash = existingHash;

      log.warn("SECURITY WARNING: Code has been modified!");
      output("The code for this tool has changed since you last ran it.");
      output("This could indicate:");
      output("  - A supply chain attack (code tampering)");
      output("  - Maintainer account compromise");
      output("  - Git history rewrite");

      output(`Expected hash: ${result.expectedHash?.slice(0, 40)}...`);
      output(`Current hash:  ${hash.slice(0, 40)}...`);

      output("Recommended actions:");
      output("  1. Check the repository for official announcements");
      output("  2. Contact the maintainer");
      output("  3. Review code changes carefully");
      output(`  4. Visit: ${getRepoWebUrl(ref, "commits")}`);

      const shouldProceed = await confirm("⚠️  Proceed anyway? (NOT RECOMMENDED)", false);

      if (shouldProceed) {
        const shouldUpdate = await confirm("Update lockfile with new hash?", false);

        if (shouldUpdate) {
          updateSecurityInfo(url, hash, true);
          log.success("Lockfile updated with new hash");
        }

        return { proceedWithExecution: true, result };
      }

      output("Execution cancelled for safety");
      return { proceedWithExecution: false, result };
    }

    default: {
      // Should never reach here, but TypeScript requires it
      error("Unknown verification result");
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
      throw new Error(`This app requires kly ${config.version}, but you have ${KLY_VERSION}`);
    }
  }

  // Check required env vars
  if (config?.env && config.env.length > 0) {
    const missing = checkEnvVars(config.env);
    if (missing.length > 0) {
      log.warn(`Required environment variables not set: ${missing.join(", ")}`);
    }
  }

  // Resolve entry point
  const entryPoint = resolveEntryPoint(repoPath, ref.subpath);
  if (!entryPoint) {
    throw new Error(`Cannot resolve entry point for ${ref.provider}:${ref.owner}/${ref.repo}`);
  }

  const absoluteEntryPath = join(repoPath, entryPoint);

  // Set remote ref environment variable for permission tracking
  const remoteRef = formatRepoUrl(ref);
  const prevRemoteRef = process.env[ENV_VARS.REMOTE_REF];
  process.env[ENV_VARS.REMOTE_REF] = remoteRef;

  try {
    // Set process.argv for the app
    process.argv = ["bun", absoluteEntryPath, ...args];

    // Handle MCP mode
    if (mcp) {
      process.env[ENV_VARS.MCP_MODE] = "true";
    }

    // Import and execute the app
    await import(absoluteEntryPath);
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
export type { CacheMetadata, KlyConfig, RepoRef, RunRemoteOptions } from "./types";
