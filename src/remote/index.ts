import { join } from "node:path";
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
  await executeApp(ref, repoPath, options.args ?? []);
}

/**
 * Execute the clai app
 */
async function executeApp(
  ref: RepoRef,
  repoPath: string,
  args: string[],
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

  // Set process.argv for detectMode() to work
  process.argv = ["bun", absoluteEntryPath, ...args];

  // Dynamic import triggers defineApp's auto-execution
  await import(absoluteEntryPath);
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
