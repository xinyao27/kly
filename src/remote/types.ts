/**
 * Supported providers
 */
export type Provider = "github" | "gitlab" | "bitbucket" | "sourcehut";

/**
 * Parsed remote repository reference
 */
export interface RepoRef {
  /** Provider (default: "github") */
  provider: Provider;
  /** GitHub owner/org */
  owner: string;
  /** Repository name */
  repo: string;
  /** Git ref: branch, tag, or commit (default: "main") */
  ref: string;
  /** Optional subpath within the repository */
  subpath?: string;
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
  /** Skip update check (use cached version without checking for updates) */
  skipUpdateCheck?: boolean;
  /** Skip bin command registration (for install command control) */
  skipRegister?: boolean;
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

/**
 * User's choice when an update is available
 */
export type UpdateChoice = "update" | "use-current" | "cancel";

/**
 * Result of checking for updates
 */
export interface UpdateCheckResult {
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Local commit SHA */
  localSha: string;
  /** Remote commit SHA (if available) */
  remoteSha?: string;
  /** Whether to proceed with update based on user choice */
  shouldUpdate: boolean;
  /** Whether the check was skipped (e.g., for commit SHA refs or network errors) */
  skipCheck?: boolean;
}

/**
 * Single repository record in lockfile
 * Combines version tracking and security information
 */
export interface LockfileRepoRecord {
  // Version tracking
  /** Git commit SHA */
  commitSha: string;
  /** When the record was last checked for updates (ISO timestamp) */
  lastChecked: string;
  /** When the repository was last updated/cloned (ISO timestamp) */
  lastUpdated: string;

  // Security tracking (from kly.sum)
  /** Integrity hash of the repository content (SHA-384) */
  integrityHash?: string;
  /** Whether the user explicitly trusted this code */
  trusted?: boolean;
  /** When the code was trusted (ISO timestamp) */
  trustedAt?: string;
}

/**
 * Structure of kly.lock.yaml
 */
export interface LockfileData {
  /** Lockfile format version */
  lockfileVersion: number;
  /** Repository records keyed by URL (e.g., "github.com/owner/repo@ref") */
  repositories: Record<string, LockfileRepoRecord>;
}
