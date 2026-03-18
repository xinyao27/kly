import { execSync } from "node:child_process";

import * as p from "@clack/prompts";

import { isGitRepo } from "../git";
import { listBranchDbs, loadState, removeBranchDb, saveState } from "../store";
import { ensureInitialized } from "./shared";

export function runGc(root: string): void {
  ensureInitialized(root);

  if (!isGitRepo(root)) {
    p.log.warn("Not a git repository. Nothing to clean.");
    return;
  }

  // Get list of active branches
  const branchOutput = execSync("git branch --format='%(refname:short)'", {
    cwd: root,
    encoding: "utf-8",
  }).trim();

  const activeBranches = new Set(
    branchOutput
      .split("\n")
      .filter(Boolean)
      .map((b) => b.replace(/'/g, "").replace(/\//g, "--")),
  );

  // Always keep "default"
  activeBranches.add("default");

  const dbNames = listBranchDbs(root);
  const state = loadState(root);
  let cleaned = 0;

  for (const dbName of dbNames) {
    // Keep active branches and detached HEAD dbs (user should clean those manually)
    if (activeBranches.has(dbName) || dbName.startsWith("_detached--")) {
      continue;
    }

    removeBranchDb(root, dbName);
    delete state.branches[dbName];
    cleaned++;
    p.log.info(`Removed: ${dbName}.db`);
  }

  if (cleaned > 0) {
    saveState(root, state);
    p.log.success(`Cleaned ${cleaned} stale database(s).`);
  } else {
    p.log.info("No stale databases found.");
  }
}
