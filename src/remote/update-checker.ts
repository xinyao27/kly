import { exec } from "node:child_process";
import { promisify } from "node:util";
import { log, output, select } from "../ui";
import { isTTY } from "../ui/utils/tty";
import { updateRepoRecord } from "./lockfile";
import type {
  CacheMetadata,
  RepoRef,
  UpdateCheckResult,
  UpdateChoice,
} from "./types";

const execAsync = promisify(exec);

/**
 * Determine if we should check for updates for this ref
 * Skip for tags and commit SHAs (immutable refs)
 */
export function shouldCheckForUpdates(ref: RepoRef): boolean {
  // Skip if it looks like a semver tag (v1.0.0, v2.3.1, 1.0.0, etc.)
  if (/^v?\d+\.\d+/.test(ref.ref)) {
    return false;
  }

  // Skip if it's a commit SHA (7-40 hex characters)
  if (/^[a-f0-9]{7,40}$/i.test(ref.ref)) {
    return false;
  }

  // Check for branch refs (everything else)
  return true;
}

/**
 * Get the git repository URL for git ls-remote
 */
function getGitRemoteUrl(ref: RepoRef): string {
  switch (ref.provider) {
    case "github":
      return `https://github.com/${ref.owner}/${ref.repo}.git`;
    case "gitlab":
      return `https://gitlab.com/${ref.owner}/${ref.repo}.git`;
    case "bitbucket":
      return `https://bitbucket.org/${ref.owner}/${ref.repo}.git`;
    case "sourcehut":
      return `https://git.sr.ht/~${ref.owner}/${ref.repo}`;
  }
}

/**
 * Get the remote commit SHA for a specific ref using git ls-remote
 * Returns null if network request fails
 */
export async function getRemoteCommitSha(ref: RepoRef): Promise<string | null> {
  try {
    const remoteUrl = getGitRemoteUrl(ref);
    const { stdout } = await execAsync(
      `git ls-remote ${remoteUrl} ${ref.ref}`,
      { timeout: 10000 }, // 10s timeout
    );

    // Output format: "abc123def456...\trefs/heads/main" or "abc123def456...\tHEAD"
    const sha = stdout.trim().split(/\s+/)[0];
    return sha || null;
  } catch {
    // Network error or ref doesn't exist - return null to allow fallback to cache
    return null;
  }
}

/**
 * Get the compare URL for viewing changes between commits
 */
function getCompareUrl(ref: RepoRef, from: string, to: string): string {
  const fromShort = from.slice(0, 12);
  const toShort = to.slice(0, 12);

  switch (ref.provider) {
    case "github":
      return `https://github.com/${ref.owner}/${ref.repo}/compare/${fromShort}...${toShort}`;
    case "gitlab":
      return `https://gitlab.com/${ref.owner}/${ref.repo}/-/compare/${fromShort}...${toShort}`;
    case "bitbucket":
      return `https://bitbucket.org/${ref.owner}/${ref.repo}/branches/compare/${toShort}..${fromShort}`;
    case "sourcehut":
      return `https://git.sr.ht/~${ref.owner}/${ref.repo}/log/${ref.ref}`;
  }
}

/**
 * Prompt user to choose what to do when an update is available
 */
export async function promptUserForUpdate(
  ref: RepoRef,
  localSha: string,
  remoteSha: string,
): Promise<UpdateChoice> {
  const repoName = `${ref.provider}:${ref.owner}/${ref.repo}#${ref.ref}`;

  output(`📦 Update available for ${repoName}`);
  output(`Local:  ${localSha.slice(0, 12)}`);
  output(`Remote: ${remoteSha.slice(0, 12)}`);
  output(`View changes: ${getCompareUrl(ref, localSha, remoteSha)}`);

  const choice = await select<UpdateChoice>({
    prompt: "What would you like to do?",
    options: [
      {
        name: "Update and run",
        value: "update",
        description: "Download the latest version and run it",
      },
      {
        name: "Use current version",
        value: "use-current",
        description: "Run the cached version",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Exit without running",
      },
    ],
  });

  return choice;
}

/**
 * Check if an update is available for a cached repository
 * Returns update check result with user's choice
 */
export async function checkForUpdates(
  ref: RepoRef,
  metadata: CacheMetadata,
): Promise<UpdateCheckResult> {
  // Use same URL format as in remote/index.ts
  const domain =
    ref.provider === "github"
      ? "github.com"
      : ref.provider === "gitlab"
        ? "gitlab.com"
        : ref.provider === "bitbucket"
          ? "bitbucket.org"
          : "sr.ht";
  const url = `${domain}/${ref.owner}/${ref.repo}@${ref.ref}`;
  const localSha = metadata.commitSha;

  // Skip update check for immutable refs (tags, commit SHAs)
  if (!shouldCheckForUpdates(ref)) {
    return {
      hasUpdate: false,
      localSha,
      shouldUpdate: false,
      skipCheck: true,
    };
  }

  // Try to get remote commit SHA
  const remoteSha = await getRemoteCommitSha(ref);

  // Network error - fallback to using cache with warning
  if (!remoteSha) {
    if (isTTY()) {
      log.warn(
        `⚠️  Unable to check for updates (network error), using cached version`,
      );
    }
    return {
      hasUpdate: false,
      localSha,
      shouldUpdate: false,
      skipCheck: true,
    };
  }

  // No update available - SHAs match
  if (remoteSha === localSha) {
    // Update lastChecked in lockfile
    updateRepoRecord(url, localSha, false);

    return {
      hasUpdate: false,
      localSha,
      remoteSha,
      shouldUpdate: false,
    };
  }

  // Update available - prompt user if in TTY mode
  if (!isTTY()) {
    // Non-interactive mode - log warning but use cached version
    log.warn(
      `Update available for ${ref.owner}/${ref.repo}@${ref.ref} ` +
        `(${localSha.slice(0, 12)} → ${remoteSha.slice(0, 12)}). ` +
        `Using cached version. Run 'kly run ${url} --force' to update.`,
    );
    return {
      hasUpdate: true,
      localSha,
      remoteSha,
      shouldUpdate: false,
    };
  }

  // Interactive mode - ask user
  const choice = await promptUserForUpdate(ref, localSha, remoteSha);

  switch (choice) {
    case "cancel":
      // User cancelled - return with shouldUpdate: false but don't treat as error
      return {
        hasUpdate: true,
        localSha,
        remoteSha,
        shouldUpdate: false,
        skipCheck: false,
      };

    case "update":
      // User chose to update
      return {
        hasUpdate: true,
        localSha,
        remoteSha,
        shouldUpdate: true,
      };

    case "use-current":
      // Update lastChecked in lockfile (user explicitly chose current version)
      updateRepoRecord(url, localSha, false);

      return {
        hasUpdate: true,
        localSha,
        remoteSha,
        shouldUpdate: false,
      };
  }
}
