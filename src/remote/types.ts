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
 * Cache metadata stored in .kly-meta.json
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
 * Kly configuration from package.json
 */
export interface KlyConfig {
  /** Minimum kly CLI version required (semver range) */
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
  /** Run in MCP mode */
  mcp?: boolean;
  /** Skip integrity verification (dangerous, for testing only) */
  skipIntegrityCheck?: boolean;
}

/**
 * Integrity verification result
 */
export interface IntegrityCheckResult {
  /** Verification status */
  status: "ok" | "mismatch" | "new";
  /** Calculated hash for the repository */
  hash: string;
  /** Expected hash from kly.sum (if exists) */
  expectedHash?: string;
  /** Whether user should be prompted to trust */
  requiresTrust: boolean;
}
