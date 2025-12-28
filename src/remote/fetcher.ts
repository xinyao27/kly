import { exec } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { getRepoCachePath } from "./parser";
import type { RepoRef } from "./types";

const execAsync = promisify(exec);

/**
 * Get the git repository URL for a given provider
 */
function getRepoUrl(ref: RepoRef): string {
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
 * Clone a repository to cache
 */
export async function cloneRepo(ref: RepoRef): Promise<void> {
  const repoUrl = getRepoUrl(ref);
  const targetPath = getRepoCachePath(ref);

  // Remove existing cache if any
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }

  // Ensure parent directory exists
  mkdirSync(dirname(targetPath), { recursive: true });

  // Shallow clone specific ref
  try {
    await execAsync(
      `git clone --depth 1 --branch ${ref.ref} ${repoUrl} "${targetPath}"`,
      {
        timeout: 60000, // 60s timeout
      },
    );
  } catch (error) {
    // If branch clone fails, try without --branch (for default branch)
    if (ref.ref === "main") {
      try {
        await execAsync(`git clone --depth 1 ${repoUrl} "${targetPath}"`, {
          timeout: 60000,
        });
        return;
      } catch {
        // Fall through to original error
      }
    }
    throw new Error(
      `Failed to clone ${ref.provider}:${ref.owner}/${ref.repo}#${ref.ref}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Install dependencies using bun
 */
export async function installDependencies(repoPath: string): Promise<void> {
  const pkgPath = `${repoPath}/package.json`;

  if (!existsSync(pkgPath)) {
    // No package.json, skip install
    return;
  }

  try {
    await execAsync("bun install", {
      cwd: repoPath,
      timeout: 120000, // 120s timeout
    });
  } catch (error) {
    throw new Error(
      `Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get the commit SHA of a cloned repo
 */
export async function getCommitSha(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", {
      cwd: repoPath,
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    return "unknown";
  }
}
