import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initKlyDir } from "../config";
import { IndexDatabase } from "../database";
import { openDatabase } from "../store";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures";

describe("dependencies table", () => {
  let tmpDir: string;
  let db: IndexDatabase;

  beforeEach(() => {
    tmpDir = createTempDir();
    initKlyDir(tmpDir);
    db = openDatabase(tmpDir, "default");
  });

  afterEach(() => {
    db.close();
    cleanupTempDir(tmpDir);
  });

  it("stores and retrieves forward dependencies", () => {
    db.upsertFile(createFileIndex({ path: "src/a.ts" }));
    db.upsertFile(createFileIndex({ path: "src/b.ts" }));
    db.upsertFile(createFileIndex({ path: "src/c.ts" }));

    db.upsertDependencies("src/a.ts", ["src/b.ts", "src/c.ts"]);

    expect(db.getDependencies("src/a.ts")).toEqual(["src/b.ts", "src/c.ts"]);
    expect(db.getDependencies("src/b.ts")).toEqual([]);
  });

  it("stores and retrieves reverse dependencies (dependents)", () => {
    db.upsertDependencies("src/a.ts", ["src/c.ts"]);
    db.upsertDependencies("src/b.ts", ["src/c.ts"]);

    expect(db.getDependents("src/c.ts")).toEqual(["src/a.ts", "src/b.ts"]);
    expect(db.getDependents("src/a.ts")).toEqual([]);
  });

  it("upsert replaces existing dependencies", () => {
    db.upsertDependencies("src/a.ts", ["src/b.ts"]);
    expect(db.getDependencies("src/a.ts")).toEqual(["src/b.ts"]);

    db.upsertDependencies("src/a.ts", ["src/c.ts"]);
    expect(db.getDependencies("src/a.ts")).toEqual(["src/c.ts"]);
  });

  it("removes dependencies for a file", () => {
    db.upsertDependencies("src/a.ts", ["src/b.ts", "src/c.ts"]);
    db.removeDependencies("src/a.ts");

    expect(db.getDependencies("src/a.ts")).toEqual([]);
  });

  it("batch removes dependencies", () => {
    db.upsertDependencies("src/a.ts", ["src/c.ts"]);
    db.upsertDependencies("src/b.ts", ["src/c.ts"]);

    db.removeDependenciesBatch(["src/a.ts", "src/b.ts"]);

    expect(db.getDependents("src/c.ts")).toEqual([]);
  });

  it("batch upserts dependencies", () => {
    db.upsertBatchDependencies([
      { fromPath: "src/a.ts", toPaths: ["src/c.ts"] },
      { fromPath: "src/b.ts", toPaths: ["src/c.ts", "src/d.ts"] },
    ]);

    expect(db.getDependencies("src/a.ts")).toEqual(["src/c.ts"]);
    expect(db.getDependencies("src/b.ts")).toEqual(["src/c.ts", "src/d.ts"]);
    expect(db.getDependents("src/c.ts")).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("removeAllDependencies clears everything", () => {
    db.upsertDependencies("src/a.ts", ["src/b.ts"]);
    db.upsertDependencies("src/c.ts", ["src/d.ts"]);

    db.removeAllDependencies();

    expect(db.getDependencies("src/a.ts")).toEqual([]);
    expect(db.getDependencies("src/c.ts")).toEqual([]);
  });
});
