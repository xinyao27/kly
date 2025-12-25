/**
 * Parsed remote repository reference
 */
export interface RepoRef {
  /** GitHub owner/org */
  owner: string;
  /** Repository name */
  repo: string;
  /** Git ref: branch, tag, or commit (default: "main") */
  ref: string;
}

/**
 * Cache metadata stored in .clai-meta.json
 */
export interface CacheMetadata {
  /** Git commit SHA at time of clone */
  commitSha: string;
  /** When the cache was created (ISO timestamp) */
  cachedAt: string;
  /** Resolved entry point path (relative to repo root) */
  entryPoint: string;
  /** Whether dependencies were installed */
  dependenciesInstalled: boolean;
}

/**
 * Clai configuration from package.json
 */
export interface ClaiConfig {
  /** Minimum clai CLI version required (semver range) */
  version?: string;
  /** Required environment variables */
  env?: string[];
}

/**
 * Result of cache validation
 */
export interface CacheCheckResult {
  /** Whether cache exists */
  exists: boolean;
  /** Whether cache is valid and ready to use */
  valid: boolean;
  /** Cache metadata if exists */
  metadata?: CacheMetadata;
  /** Reason why cache is invalid */
  reason?: string;
}

/**
 * Options for running remote repos
 */
export interface RunRemoteOptions {
  /** Force re-fetch even if cached */
  force?: boolean;
  /** Skip dependency installation */
  skipInstall?: boolean;
  /** Arguments to pass to the app */
  args?: string[];
}
