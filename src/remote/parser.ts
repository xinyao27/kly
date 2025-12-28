import { homedir } from "node:os";
import { join } from "node:path";
import type { Provider, RepoRef } from "./types";

/**
 * Provider aliases (giget-style)
 */
const PROVIDER_ALIASES: Record<string, Provider> = {
  gh: "github",
  github: "github",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
  sourcehut: "sourcehut",
};

/**
 * Parse various remote formats into RepoRef
 *
 * Supported formats (giget-style):
 * - gh:user/repo
 * - gh:user/repo#branch
 * - gh:user/repo/subpath
 * - gh:user/repo/subpath#branch
 * - gitlab:user/repo
 * - bitbucket:user/repo
 * - sourcehut:user/repo
 *
 * Legacy formats (backward compatible):
 * - user/repo
 * - user/repo@branch
 * - github.com/user/repo
 * - https://github.com/user/repo
 */
export function parseRemoteRef(input: string): RepoRef | null {
  let normalized = input.trim();
  let provider: Provider = "github";
  let ref = "main";
  let subpath: string | undefined;

  // First, remove https:// or http:// prefix if present
  normalized = normalized.replace(/^https?:\/\//, "");

  // Check for provider prefix (gh:, gitlab:, etc.)
  const providerMatch = normalized.match(/^([a-z]+):/);
  if (providerMatch?.[1]) {
    const alias = providerMatch[1];
    const matchedProvider = PROVIDER_ALIASES[alias];
    if (matchedProvider) {
      provider = matchedProvider;
      normalized = normalized.slice(providerMatch[0].length);
    }
  }

  // Remove github.com/ prefix (legacy support)
  normalized = normalized.replace(/^github\.com\//, "");

  // Extract ref using # (giget-style: user/repo#ref)
  const hashIndex = normalized.indexOf("#");
  if (hashIndex !== -1) {
    ref = normalized.slice(hashIndex + 1);
    normalized = normalized.slice(0, hashIndex);
  } else {
    // Fallback to @ for backward compatibility (user/repo@ref)
    const atIndex = normalized.indexOf("@");
    if (atIndex !== -1) {
      ref = normalized.slice(atIndex + 1);
      normalized = normalized.slice(0, atIndex);
    }
  }

  // Remove trailing .git (after ref extraction)
  normalized = normalized.replace(/\.git$/, "");

  // Parse owner/repo/subpath
  const parts = normalized.split("/");
  if (parts.length < 2) {
    return null;
  }

  const [owner, repo, ...subpathParts] = parts;

  // Validate owner and repo names
  if (
    !owner ||
    !repo ||
    !isValidGitHubName(owner) ||
    !isValidGitHubName(repo)
  ) {
    return null;
  }

  // Extract subpath if present
  if (subpathParts.length > 0) {
    subpath = subpathParts.join("/");
  }

  return { provider, owner, repo, ref, subpath };
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
 * Get the kly cache directory
 */
export function getCacheDir(): string {
  return join(homedir(), ".kly", "cache");
}

/**
 * Get provider domain name
 */
function getProviderDomain(provider: Provider): string {
  switch (provider) {
    case "github":
      return "github.com";
    case "gitlab":
      return "gitlab.com";
    case "bitbucket":
      return "bitbucket.org";
    case "sourcehut":
      return "sr.ht";
  }
}

/**
 * Get the cache path for a specific repo ref
 */
export function getRepoCachePath(ref: RepoRef): string {
  const domain = getProviderDomain(ref.provider);
  const basePath = join(getCacheDir(), domain, ref.owner, ref.repo, ref.ref);

  // Include subpath in cache key if present
  if (ref.subpath) {
    return join(basePath, ref.subpath);
  }

  return basePath;
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
