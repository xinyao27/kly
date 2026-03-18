import fs from "node:fs";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { getDbDir, getDbPath, getStatePath } from "./config.js";
import { IndexDatabase } from "./database.js";
import { branchToDbName, getCurrentBranch, getCurrentCommit, isGitRepo } from "./git.js";
import type { BranchState, FileIndex, GitState } from "./types.js";

const STATE_VERSION = 2;

// --- Database management ---

export function openDatabase(root: string, dbName?: string): IndexDatabase {
  const name = dbName || resolveDbName(root);
  const dbDir = getDbDir(root);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return new IndexDatabase(getDbPath(root, name));
}

export function resolveDbName(root: string): string {
  if (!isGitRepo(root)) {
    return "default";
  }
  const branch = getCurrentBranch(root);
  const commit = branch === null ? getCurrentCommit(root) : undefined;
  return branchToDbName(branch, commit);
}

export function copyDatabase(root: string, fromName: string, toName: string): void {
  const fromPath = getDbPath(root, fromName);
  const toPath = getDbPath(root, toName);
  if (fs.existsSync(fromPath)) {
    fs.copyFileSync(fromPath, toPath);
  }
}

// --- State management ---

export function loadState(root: string): GitState {
  const statePath = getStatePath(root);
  if (!fs.existsSync(statePath)) {
    return { version: STATE_VERSION, configHash: "", branches: {} };
  }
  const raw = fs.readFileSync(statePath, "utf-8");
  return parseYaml(raw) as GitState;
}

export function saveState(root: string, state: GitState): void {
  const statePath = getStatePath(root);
  fs.writeFileSync(statePath, stringifyYaml(state), "utf-8");
}

export function getBranchState(state: GitState, dbName: string): BranchState | undefined {
  return state.branches[dbName];
}

export function setBranchState(state: GitState, dbName: string, branchState: BranchState): void {
  state.branches[dbName] = branchState;
}

// --- Convenience wrappers (for commands that just need quick access) ---

export function getFileFromDb(root: string, filePath: string): FileIndex | undefined {
  const db = openDatabase(root);
  try {
    return db.getFile(filePath);
  } finally {
    db.close();
  }
}

export function getAllFilesFromDb(root: string): FileIndex[] {
  const db = openDatabase(root);
  try {
    return db.getAllFiles();
  } finally {
    db.close();
  }
}

// --- Branch db cleanup ---

export function listBranchDbs(root: string): string[] {
  const dbDir = getDbDir(root);
  if (!fs.existsSync(dbDir)) return [];
  return fs
    .readdirSync(dbDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => f.replace(/\.db$/, ""));
}

export function removeBranchDb(root: string, dbName: string): void {
  const dbPath = getDbPath(root, dbName);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  // Also remove WAL and SHM files
  for (const ext of ["-wal", "-shm"]) {
    const auxPath = dbPath + ext;
    if (fs.existsSync(auxPath)) {
      fs.unlinkSync(auxPath);
    }
  }
}
