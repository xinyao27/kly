import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import type { LockfileData, LockfileRepoRecord } from "./types";

/**
 * Get the path to the global lockfile
 */
export function getLockfilePath(): string {
  return join(homedir(), ".kly", "kly.lock.yaml");
}

/**
 * Read the lockfile, creating an empty one if it doesn't exist
 */
export function readLockfile(): LockfileData {
  const lockfilePath = getLockfilePath();

  if (!existsSync(lockfilePath)) {
    return {
      lockfileVersion: 1,
      repositories: {},
    };
  }

  try {
    const content = readFileSync(lockfilePath, "utf-8");
    const data = yaml.load(content) as LockfileData;

    // Validate basic structure
    if (!data || typeof data !== "object") {
      throw new Error("Invalid lockfile format");
    }

    // Ensure repositories field exists
    if (!data.repositories || typeof data.repositories !== "object") {
      data.repositories = {};
    }

    // Set lockfile version if missing
    if (!data.lockfileVersion) {
      data.lockfileVersion = 1;
    }

    return data;
  } catch (error) {
    console.warn(
      `Warning: Failed to read lockfile (${error instanceof Error ? error.message : "unknown error"}), creating new one`,
    );
    return {
      lockfileVersion: 1,
      repositories: {},
    };
  }
}

/**
 * Write the lockfile to disk
 */
export function writeLockfile(data: LockfileData): void {
  const lockfilePath = getLockfilePath();

  // Ensure directory exists
  mkdirSync(dirname(lockfilePath), { recursive: true });

  // Add header comment
  const header =
    "# kly.lock.yaml - Unified version and security tracking\n" +
    "# This file is auto-generated and auto-updated\n" +
    "#\n" +
    "# Format:\n" +
    "#   lockfileVersion: 1\n" +
    "#   repositories:\n" +
    "#     github.com/owner/repo@ref:\n" +
    "#       commitSha: abc123...           # Git commit SHA\n" +
    "#       lastChecked: 2025-12-28...     # Last update check\n" +
    "#       lastUpdated: 2025-12-27...     # Last clone/update\n" +
    "#       integrityHash: sha384-xxx...   # Code content hash\n" +
    "#       trusted: true                  # User trust status\n" +
    "#       trustedAt: 2025-12-27...       # When trusted\n" +
    "\n";

  const yamlContent = yaml.dump(data, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: true,
  });

  writeFileSync(lockfilePath, header + yamlContent, "utf-8");
}

/**
 * Get a specific repository record from the lockfile
 */
export function getRepoRecord(url: string): LockfileRepoRecord | undefined {
  const lockfile = readLockfile();
  return lockfile.repositories[url];
}

/**
 * Update or add version information for a repository
 */
export function updateRepoRecord(
  url: string,
  commitSha: string,
  isUpdate = false,
): void {
  const lockfile = readLockfile();
  const now = new Date().toISOString();
  const existing = lockfile.repositories[url];

  lockfile.repositories[url] = {
    // Version info
    commitSha,
    lastChecked: now,
    lastUpdated: isUpdate ? now : (existing?.lastUpdated ?? now),
    // Preserve security info if it exists
    integrityHash: existing?.integrityHash,
    trusted: existing?.trusted,
    trustedAt: existing?.trustedAt,
  };

  writeLockfile(lockfile);
}

/**
 * Update security information for a repository
 */
export function updateSecurityInfo(
  url: string,
  integrityHash: string,
  trusted: boolean,
): void {
  const lockfile = readLockfile();
  const existing = lockfile.repositories[url];
  const now = new Date().toISOString();

  if (!existing) {
    // If no version info exists, create minimal record
    lockfile.repositories[url] = {
      commitSha: "",
      lastChecked: now,
      lastUpdated: now,
      integrityHash,
      trusted,
      trustedAt: now,
    };
  } else {
    // Update existing record
    lockfile.repositories[url] = {
      ...existing,
      integrityHash,
      trusted,
      trustedAt: now,
    };
  }

  writeLockfile(lockfile);
}

/**
 * Get integrity hash for a repository
 */
export function getIntegrityHash(url: string): string | undefined {
  const record = getRepoRecord(url);
  return record?.integrityHash;
}

/**
 * Check if a repository is trusted
 */
export function isTrusted(url: string): boolean {
  const record = getRepoRecord(url);
  return record?.trusted ?? false;
}
