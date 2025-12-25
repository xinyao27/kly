import { homedir } from "node:os";
import { join } from "node:path";
import type { RepoRef } from "./types";

/**
 * Parse various remote formats into RepoRef
 *
 * Supported formats:
 * - user/repo
 * - user/repo@v1.0.0
 * - user/repo@branch
 * - github.com/user/repo
 * - github.com/user/repo@ref
 * - https://github.com/user/repo
 */
export function parseRemoteRef(input: string): RepoRef | null {
  let normalized = input.trim();

  // Remove https:// or http:// prefix
  normalized = normalized.replace(/^https?:\/\//, "");

  // Remove github.com/ prefix
  normalized = normalized.replace(/^github\.com\//, "");

  // Extract ref if present (user/repo@ref or user/repo.git@ref)
  let ref = "main";
  const atIndex = normalized.indexOf("@");
  if (atIndex !== -1) {
    ref = normalized.slice(atIndex + 1);
    normalized = normalized.slice(0, atIndex);
  }

  // Remove trailing .git (after @ extraction)
  normalized = normalized.replace(/\.git$/, "");

  // Parse owner/repo
  const parts = normalized.split("/");
  if (parts.length !== 2) {
    return null;
  }

  const [owner, repo] = parts;

  // Validate owner and repo names
  if (
    !owner ||
    !repo ||
    !isValidGitHubName(owner) ||
    !isValidGitHubName(repo)
  ) {
    return null;
  }

  return { owner, repo, ref };
}

/**
 * Check if a string is a valid GitHub username or repo name
 */
function isValidGitHubName(name: string): boolean {
  // GitHub names: alphanumeric, hyphens, no consecutive hyphens, no start/end with hyphen
  return (
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(name) ||
    /^[a-zA-Z0-9]$/.test(name)
  );
}

/**
 * Get the clai cache directory
 */
export function getCacheDir(): string {
  return join(homedir(), ".clai", "cache");
}

/**
 * Get the cache path for a specific repo ref
 */
export function getRepoCachePath(ref: RepoRef): string {
  return join(getCacheDir(), "github.com", ref.owner, ref.repo, ref.ref);
}

/**
 * Check if an input looks like a remote reference (vs local file path)
 */
export function isRemoteRef(input: string): boolean {
  // Local paths start with ./ ../ / or contain backslash (Windows)
  if (
    input.startsWith("./") ||
    input.startsWith("../") ||
    input.startsWith("/") ||
    input.includes("\\")
  ) {
    return false;
  }

  // Check if it parses as a valid remote ref
  return parseRemoteRef(input) !== null;
}
