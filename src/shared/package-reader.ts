import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AppMetadata } from "../types";

/**
 * Find the nearest package.json by walking up the directory tree
 */
function findPackageJson(startDir: string): string | null {
  let currentDir = startDir;
  const root = "/";

  while (currentDir !== root) {
    const pkgPath = join(currentDir, "package.json");
    if (existsSync(pkgPath)) {
      return pkgPath;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Read app metadata from package.json
 * Searches for package.json starting from the specified directory
 * and walking up the directory tree
 *
 * Use cases:
 * - When running `kly run <repo>`: Read metadata from the repo's package.json
 * - In bin registry: Get project name/version for command registration
 *
 * Do NOT use:
 * - In defineApp(): Users should explicitly provide metadata in standalone scripts
 *
 * @param searchDir - Directory to start searching from (defaults to process.cwd())
 * @returns Partial metadata from package.json, or empty object if not found
 */
export function readPackageMetadata(searchDir: string = process.cwd()): Partial<AppMetadata> {
  try {
    const pkgPath = findPackageJson(searchDir);

    if (!pkgPath) {
      return {};
    }

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

    return {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
    };
  } catch {
    // Failed to read or parse package.json
    return {};
  }
}
