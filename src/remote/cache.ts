import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getRepoCachePath } from "./parser";
import type { CacheCheckResult, CacheMetadata, RepoRef } from "./types";

const META_FILENAME = ".kly-meta.json";

/**
 * Check if cache exists and is valid
 */
export function checkCache(ref: RepoRef): CacheCheckResult {
  const cachePath = getRepoCachePath(ref);
  const metaPath = join(cachePath, META_FILENAME);

  if (!existsSync(cachePath)) {
    return {
      exists: false,
      valid: false,
      reason: "Cache directory does not exist",
    };
  }

  if (!existsSync(metaPath)) {
    return { exists: true, valid: false, reason: "Cache metadata missing" };
  }

  try {
    const metadata = JSON.parse(
      readFileSync(metaPath, "utf-8"),
    ) as CacheMetadata;

    // Check if entry point still exists
    const entryPath = join(cachePath, metadata.entryPoint);
    if (!existsSync(entryPath)) {
      return {
        exists: true,
        valid: false,
        metadata,
        reason: "Entry point file missing",
      };
    }

    // Check if dependencies were installed
    if (!metadata.dependenciesInstalled) {
      return {
        exists: true,
        valid: false,
        metadata,
        reason: "Dependencies not installed",
      };
    }

    return { exists: true, valid: true, metadata };
  } catch {
    return { exists: true, valid: false, reason: "Invalid cache metadata" };
  }
}

/**
 * Read cache metadata
 */
export function readMetadata(ref: RepoRef): CacheMetadata | null {
  const cachePath = getRepoCachePath(ref);
  const metaPath = join(cachePath, META_FILENAME);

  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as CacheMetadata;
  } catch {
    return null;
  }
}

/**
 * Write cache metadata
 */
export function writeMetadata(ref: RepoRef, metadata: CacheMetadata): void {
  const cachePath = getRepoCachePath(ref);
  const metaPath = join(cachePath, META_FILENAME);

  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
}

/**
 * Remove cached repository
 */
export function invalidateCache(ref: RepoRef): void {
  const cachePath = getRepoCachePath(ref);

  if (existsSync(cachePath)) {
    rmSync(cachePath, { recursive: true, force: true });
  }
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  const { getCacheDir } = require("./parser");
  const cacheDir = getCacheDir();

  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}
