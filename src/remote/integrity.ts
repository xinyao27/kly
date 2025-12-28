import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  type Stats,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";

/**
 * Directories and files to ignore when calculating repository hash
 */
const IGNORE_PATTERNS = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".kly",
  ".kly-meta.json",
  ".DS_Store",
  "*.log",
];

/**
 * File extensions to include in hash calculation
 */
const SOURCE_EXTENSIONS = [
  ".ts",
  ".js",
  ".tsx",
  ".jsx",
  ".json",
  ".md",
  ".txt",
];

/**
 * Calculate integrity hash for a cloned repository
 * Uses SHA-384 (consistent with browser Subresource Integrity)
 *
 * Hash includes:
 * - All source code files (sorted by path)
 * - File paths (for structure verification)
 * - Lock file (bun.lockb) if present
 *
 * @param repoPath - Absolute path to the repository
 * @param algorithm - Hash algorithm (default: sha384)
 * @returns Hash in format "sha384-base64..."
 */
export function calculateRepoHash(
  repoPath: string,
  algorithm: "sha256" | "sha384" | "sha512" = "sha384",
): string {
  const hash = createHash(algorithm);

  // 1. Collect all source files
  const files = collectSourceFiles(repoPath);

  // 2. Sort by relative path (ensures consistent ordering)
  files.sort();

  // 3. Hash each file (path + content)
  for (const file of files) {
    const relativePath = relative(repoPath, file);
    const content = readFileSync(file);

    // Include file path in hash (detects file moves/renames)
    hash.update(`FILE:${relativePath}\n`);
    hash.update(content);
    hash.update("\n");
  }

  // 4. Include lock file if present (dependency integrity)
  const lockFile = join(repoPath, "bun.lockb");
  if (existsSync(lockFile)) {
    hash.update("LOCK:bun.lockb\n");
    hash.update(readFileSync(lockFile));
    hash.update("\n");
  }

  // 5. Generate base64 digest
  const digest = hash.digest("base64");
  return `${algorithm}-${digest}`;
}

/**
 * Recursively collect all source files in a directory
 *
 * @param dir - Directory to scan
 * @param results - Accumulator for file paths
 * @returns Array of absolute file paths
 */
function collectSourceFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip ignored patterns
      if (shouldIgnore(entry)) {
        continue;
      }

      const fullPath = join(dir, entry);
      let stat: Stats;

      try {
        stat = statSync(fullPath);
      } catch {
        // Skip files we can't stat (permission issues, symlinks, etc.)
        continue;
      }

      if (stat.isDirectory()) {
        collectSourceFiles(fullPath, results);
      } else if (stat.isFile() && shouldIncludeFile(entry)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

/**
 * Check if a file/directory should be ignored
 */
function shouldIgnore(name: string): boolean {
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.startsWith("*")) {
      // Wildcard pattern (e.g., *.log)
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) {
        return true;
      }
    } else if (name === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a file should be included in hash calculation
 */
function shouldIncludeFile(name: string): boolean {
  return SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Parse a hash string into its components
 *
 * @param hashString - Hash in format "sha384-base64..."
 * @returns Parsed components or null if invalid
 */
export function parseHashString(
  hashString: string,
): { algorithm: string; digest: string } | null {
  const match = hashString.match(/^(sha256|sha384|sha512)-(.+)$/);
  if (!match) {
    return null;
  }

  return {
    algorithm: match[1] as string,
    digest: match[2] as string,
  };
}

/**
 * Compare two hash strings for equality
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @returns true if hashes match
 */
export function compareHashes(hash1: string, hash2: string): boolean {
  const parsed1 = parseHashString(hash1);
  const parsed2 = parseHashString(hash2);

  if (!parsed1 || !parsed2) {
    return false;
  }

  // Must use same algorithm
  if (parsed1.algorithm !== parsed2.algorithm) {
    return false;
  }

  return parsed1.digest === parsed2.digest;
}
