import { execSync } from "node:child_process";

import type { GitCommit, GitDiff } from "./types";

function exec(root: string, cmd: string): string {
  return execSync(cmd, { cwd: root, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

export function isGitRepo(root: string): boolean {
  try {
    exec(root, "git rev-parse --is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

export function getCurrentBranch(root: string): string | null {
  try {
    return exec(root, "git symbolic-ref --short HEAD");
  } catch {
    // Detached HEAD
    return null;
  }
}

export function getCurrentCommit(root: string): string {
  return exec(root, "git rev-parse HEAD");
}

export function getChangedFiles(root: string, from: string, to?: string): GitDiff {
  const target = to || "HEAD";
  const output = exec(root, `git diff --name-status ${from} ${target}`);

  const diff: GitDiff = { added: [], modified: [], deleted: [], renamed: [] };

  if (!output) return diff;

  for (const line of output.split("\n")) {
    const parts = line.split("\t");
    const status = parts[0];
    const filePath = parts[1];

    switch (status[0]) {
      case "A":
        diff.added.push(filePath);
        break;
      case "M":
        diff.modified.push(filePath);
        break;
      case "D":
        diff.deleted.push(filePath);
        break;
      case "R":
        diff.renamed.push({ from: filePath, to: parts[2] });
        break;
    }
  }

  return diff;
}

export function isAncestor(root: string, ancestor: string, descendant: string): boolean {
  try {
    execSync(`git merge-base --is-ancestor ${ancestor} ${descendant}`, {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

export function getMergeBase(root: string, a: string, b: string): string | null {
  try {
    return exec(root, `git merge-base ${a} ${b}`);
  } catch {
    return null;
  }
}

export function getFileHistory(root: string, filePath: string, limit = 5): GitCommit[] {
  let output: string;
  try {
    output = exec(root, `git log --follow -n ${limit} --format="%H|%an|%ae|%at|%s" -- "${filePath}"`);
  } catch {
    return [];
  }
  if (!output) return [];
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, author, email, date, ...msgParts] = line.split("|");
      return {
        hash,
        author,
        email,
        date: parseInt(date, 10),
        message: msgParts.join("|"),
      };
    });
}

export function branchToDbName(branch: string | null, commitHash?: string): string {
  if (branch === null) {
    const shortHash = commitHash ? commitHash.slice(0, 8) : "unknown";
    return `_detached--${shortHash}`;
  }
  return branch.replace(/\//g, "--");
}
