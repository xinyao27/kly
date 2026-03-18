import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initKlyDir } from "../config";
import type { IndexDatabase } from "../database";
import { buildDependencyGraph, generateMermaid } from "../graph";
import { openDatabase } from "../store";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures";

describe("graph", () => {
  let tmpDir: string;
  let db: IndexDatabase;

  beforeEach(() => {
    tmpDir = createTempDir();
    initKlyDir(tmpDir);
    db = openDatabase(tmpDir, "test");
  });

  afterEach(() => {
    db.close();
    cleanupTempDir(tmpDir);
  });

  describe("buildDependencyGraph", () => {
    it("should return empty graph for empty db", () => {
      const graph = buildDependencyGraph(db);
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges).toEqual([]);
    });

    it("should include nodes with no dependencies", () => {
      db.upsertFile(createFileIndex({ path: "src/a.ts", imports: [] }));
      const graph = buildDependencyGraph(db);
      expect(graph.nodes.size).toBe(1);
      expect(graph.edges).toEqual([]);
    });

    it("should resolve relative imports between indexed files", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
        createFileIndex({ path: "src/b.ts", imports: [] }),
      ]);
      const graph = buildDependencyGraph(db);
      expect(graph.nodes.size).toBe(2);
      expect(graph.edges).toEqual([{ from: "src/a.ts", to: "src/b.ts" }]);
    });

    it("should skip third-party imports", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts", imports: ["lodash", "react", "./b"] }),
        createFileIndex({ path: "src/b.ts", imports: [] }),
      ]);
      const graph = buildDependencyGraph(db);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toEqual({ from: "src/a.ts", to: "src/b.ts" });
    });

    it("should resolve imports with extensions", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts", imports: ["./b.ts"] }),
        createFileIndex({ path: "src/b.ts", imports: [] }),
      ]);
      const graph = buildDependencyGraph(db);
      expect(graph.edges).toEqual([{ from: "src/a.ts", to: "src/b.ts" }]);
    });

    it("should resolve index imports", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts", imports: ["./utils"] }),
        createFileIndex({ path: "src/utils/index.ts", imports: [] }),
      ]);
      const graph = buildDependencyGraph(db);
      expect(graph.edges).toEqual([{ from: "src/a.ts", to: "src/utils/index.ts" }]);
    });

    it("should handle circular dependencies", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
        createFileIndex({ path: "src/b.ts", imports: ["./a"] }),
      ]);
      const graph = buildDependencyGraph(db);
      expect(graph.edges).toHaveLength(2);
      expect(graph.edges).toContainEqual({ from: "src/a.ts", to: "src/b.ts" });
      expect(graph.edges).toContainEqual({ from: "src/b.ts", to: "src/a.ts" });
    });

    it("should skip unresolvable relative imports", () => {
      db.upsertFile(createFileIndex({ path: "src/a.ts", imports: ["./nonexistent"] }));
      const graph = buildDependencyGraph(db);
      expect(graph.nodes.size).toBe(1);
      expect(graph.edges).toEqual([]);
    });

    it("should resolve .tsx extensions", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/app.ts", imports: ["./Button"] }),
        createFileIndex({ path: "src/Button.tsx", imports: [] }),
      ]);
      const graph = buildDependencyGraph(db);
      expect(graph.edges).toEqual([{ from: "src/app.ts", to: "src/Button.tsx" }]);
    });

    it("should not duplicate nodes in focus BFS when multiple paths lead to same file", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts", imports: ["./c"] }),
        createFileIndex({ path: "src/b.ts", imports: ["./c"] }),
        createFileIndex({ path: "src/c.ts", imports: [] }),
      ]);
      // Focus on c — both a and b depend on c, BFS should visit c then a and b
      const graph = buildDependencyGraph(db, { focus: "src/c.ts", depth: 1 });
      expect(graph.nodes.size).toBe(3);
    });

    describe("focus mode", () => {
      it("should include only focused file and its direct dependencies", () => {
        db.upsertFiles([
          createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
          createFileIndex({ path: "src/b.ts", imports: ["./c"] }),
          createFileIndex({ path: "src/c.ts", imports: [] }),
          createFileIndex({ path: "src/d.ts", imports: [] }),
        ]);
        const graph = buildDependencyGraph(db, { focus: "src/a.ts", depth: 1 });
        expect(graph.nodes.has("src/a.ts")).toBe(true);
        expect(graph.nodes.has("src/b.ts")).toBe(true);
        expect(graph.nodes.has("src/c.ts")).toBe(false);
        expect(graph.nodes.has("src/d.ts")).toBe(false);
      });

      it("should include deeper dependencies with higher depth", () => {
        db.upsertFiles([
          createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
          createFileIndex({ path: "src/b.ts", imports: ["./c"] }),
          createFileIndex({ path: "src/c.ts", imports: [] }),
        ]);
        const graph = buildDependencyGraph(db, { focus: "src/a.ts", depth: 2 });
        expect(graph.nodes.has("src/a.ts")).toBe(true);
        expect(graph.nodes.has("src/b.ts")).toBe(true);
        expect(graph.nodes.has("src/c.ts")).toBe(true);
      });

      it("should include reverse dependencies (files that import the focused file)", () => {
        db.upsertFiles([
          createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
          createFileIndex({ path: "src/b.ts", imports: [] }),
          createFileIndex({ path: "src/c.ts", imports: [] }),
        ]);
        const graph = buildDependencyGraph(db, { focus: "src/b.ts", depth: 1 });
        expect(graph.nodes.has("src/a.ts")).toBe(true);
        expect(graph.nodes.has("src/b.ts")).toBe(true);
        expect(graph.nodes.has("src/c.ts")).toBe(false);
      });

      it("should return only focus node if no dependencies exist", () => {
        db.upsertFiles([
          createFileIndex({ path: "src/a.ts", imports: [] }),
          createFileIndex({ path: "src/b.ts", imports: [] }),
        ]);
        const graph = buildDependencyGraph(db, { focus: "src/a.ts", depth: 1 });
        expect(graph.nodes.size).toBe(1);
        expect(graph.nodes.has("src/a.ts")).toBe(true);
      });

      it("should not re-add already included deps in BFS", () => {
        // a->b, a->c, b->c => when BFS processes a's deps, c gets added;
        // when processing b's deps, c is already included
        db.upsertFiles([
          createFileIndex({ path: "src/a.ts", imports: ["./b", "./c"] }),
          createFileIndex({ path: "src/b.ts", imports: ["./c"] }),
          createFileIndex({ path: "src/c.ts", imports: [] }),
        ]);
        const graph = buildDependencyGraph(db, { focus: "src/a.ts", depth: 2 });
        expect(graph.nodes.size).toBe(3);
        // c should only appear once
        const cEdges = graph.edges.filter((e) => e.to === "src/c.ts");
        expect(cEdges).toHaveLength(2); // from a and from b
      });

      it("should stop at depth 0 (focus node only, no expansion)", () => {
        db.upsertFiles([
          createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
          createFileIndex({ path: "src/b.ts", imports: [] }),
        ]);
        const graph = buildDependencyGraph(db, { focus: "src/a.ts", depth: 0 });
        expect(graph.nodes.size).toBe(1);
        expect(graph.nodes.has("src/a.ts")).toBe(true);
      });

      it("should handle focus on a file that has no entry in adjacency (non-indexed focus)", () => {
        db.upsertFile(createFileIndex({ path: "src/a.ts", imports: [] }));
        const graph = buildDependencyGraph(db, { focus: "src/nonexistent.ts", depth: 1 });
        // Focus path is added to includedPaths but has no fileMap entry
        expect(graph.nodes.size).toBe(0);
        expect(graph.edges).toEqual([]);
      });
    });
  });

  describe("generateMermaid", () => {
    it("should generate valid mermaid syntax", () => {
      db.upsertFiles([
        createFileIndex({ path: "src/a.ts", imports: ["./b"] }),
        createFileIndex({ path: "src/b.ts", imports: [] }),
      ]);
      const graph = buildDependencyGraph(db);
      const mermaid = generateMermaid(graph);

      expect(mermaid).toContain("graph LR");
      expect(mermaid).toContain('"src/a.ts"');
      expect(mermaid).toContain('"src/b.ts"');
      expect(mermaid).toMatch(/N\d+ --> N\d+/);
    });

    it("should generate empty graph for no edges", () => {
      db.upsertFile(createFileIndex({ path: "src/a.ts", imports: [] }));
      const graph = buildDependencyGraph(db);
      const mermaid = generateMermaid(graph);

      expect(mermaid).toContain("graph LR");
      expect(mermaid).toContain('"src/a.ts"');
      expect(mermaid).not.toContain("-->");
    });

    it("should escape quotes in file paths", () => {
      const graph = {
        nodes: new Map([
          ["src/it's.ts", { path: "src/it's.ts", name: "Test", language: "typescript" as const }],
        ]),
        edges: [],
      };
      const mermaid = generateMermaid(graph);
      expect(mermaid).toContain("src/it's.ts");
    });

    it("should skip edges referencing unknown nodes", () => {
      const graph = {
        nodes: new Map([
          ["src/a.ts", { path: "src/a.ts", name: "A", language: "typescript" as const }],
        ]),
        edges: [{ from: "src/a.ts", to: "src/unknown.ts" }],
      };
      const mermaid = generateMermaid(graph);
      expect(mermaid).not.toContain("-->");
    });
  });
});
