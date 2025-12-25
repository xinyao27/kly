import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ClaiConfig } from "./types";

/**
 * Entry point candidates to search for (in order)
 */
const ENTRY_CANDIDATES = [
  "index.ts",
  "main.ts",
  "src/index.ts",
  "src/main.ts",
  "app.ts",
];

/**
 * Resolve entry point for a clai app
 * Priority: main field > convention candidates
 */
export function resolveEntryPoint(repoPath: string): string | null {
  const pkgPath = join(repoPath, "package.json");

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

      // Check main field (standard npm field)
      if (pkg.main && (pkg.main.endsWith(".ts") || pkg.main.endsWith(".js"))) {
        const mainPath = join(repoPath, pkg.main);
        if (existsSync(mainPath)) {
          return pkg.main; // Return relative path
        }
      }
    } catch {
      // Invalid package.json, continue to candidates
    }
  }

  // Try convention candidates
  for (const candidate of ENTRY_CANDIDATES) {
    const candidatePath = join(repoPath, candidate);
    if (existsSync(candidatePath)) {
      return candidate; // Return relative path
    }
  }

  return null;
}

/**
 * Read clai configuration from package.json
 */
export function readClaiConfig(repoPath: string): ClaiConfig | null {
  const pkgPath = join(repoPath, "package.json");

  if (!existsSync(pkgPath)) {
    return null;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.clai ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if current clai version satisfies the required version
 * Simple semver check (supports >=x.y.z format)
 */
export function validateVersion(required: string, current: string): boolean {
  // Parse >=x.y.z format
  const reqMatch = required.match(/^>=?\s*(\d+)\.(\d+)\.(\d+)/);
  if (!reqMatch) {
    // Unknown format, skip validation
    return true;
  }

  const curMatch = current.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!curMatch) {
    return true;
  }

  const reqMajor = Number(reqMatch[1]);
  const reqMinor = Number(reqMatch[2]);
  const reqPatch = Number(reqMatch[3]);
  const curMajor = Number(curMatch[1]);
  const curMinor = Number(curMatch[2]);
  const curPatch = Number(curMatch[3]);

  // Compare versions
  if (curMajor > reqMajor) return true;
  if (curMajor < reqMajor) return false;
  if (curMinor > reqMinor) return true;
  if (curMinor < reqMinor) return false;
  return curPatch >= reqPatch;
}

/**
 * Check required environment variables
 * Returns list of missing variables
 */
export function checkEnvVars(required: string[]): string[] {
  return required.filter((name) => !process.env[name]);
}
