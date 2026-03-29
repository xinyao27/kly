import path from "node:path";

import { renderMermaidASCII, renderMermaidSVG } from "beautiful-mermaid";

import type { IndexDatabase } from "./database";
import type { FileIndex, Language } from "./types";

export type GraphFormat = "json" | "mermaid" | "ascii" | "svg";

export interface GraphNode {
  path: string;
  name: string;
  language: Language;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

const RESOLVE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
];

export function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith(".") || importPath.startsWith("/");
}

/**
 * Resolve a relative import path to a file path that exists in the index.
 */
export function resolveImport(
  fromFile: string,
  importPath: string,
  indexedPaths: Set<string>,
): string | undefined {
  if (!isRelativeImport(importPath)) return undefined;

  const dir = path.dirname(fromFile);
  const resolved = path.normalize(path.join(dir, importPath));

  // Direct match (already has extension)
  if (indexedPaths.has(resolved)) return resolved;

  // Try extension completion
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = resolved + ext;
    if (indexedPaths.has(candidate)) return candidate;
  }

  return undefined;
}

/**
 * Build a dependency graph from indexed files.
 */
export function buildDependencyGraph(
  db: IndexDatabase,
  options: { focus?: string; depth?: number } = {},
): DependencyGraph {
  const { focus, depth = 2 } = options;
  const allFiles = db.getAllFiles();
  const indexedPaths = new Set(allFiles.map((f) => f.path));
  const fileMap = new Map<string, FileIndex>();
  for (const file of allFiles) {
    fileMap.set(file.path, file);
  }

  // Build full adjacency list
  const adjacency = new Map<string, string[]>();
  for (const file of allFiles) {
    const deps: string[] = [];
    for (const imp of file.imports) {
      const resolved = resolveImport(file.path, imp, indexedPaths);
      if (resolved) deps.push(resolved);
    }
    adjacency.set(file.path, deps);
  }

  // Determine which nodes to include
  let includedPaths: Set<string>;

  if (focus) {
    // BFS from focus node up to depth
    includedPaths = new Set<string>();
    const queue: Array<{ path: string; currentDepth: number }> = [{ path: focus, currentDepth: 0 }];
    includedPaths.add(focus);

    while (queue.length > 0) {
      const { path: current, currentDepth } = queue.shift()!;
      if (currentDepth >= depth) continue;

      // Forward edges (dependencies of current)
      const deps = adjacency.get(current) || [];
      for (const dep of deps) {
        if (!includedPaths.has(dep)) {
          includedPaths.add(dep);
          queue.push({ path: dep, currentDepth: currentDepth + 1 });
        }
      }

      // Reverse edges (files that depend on current)
      for (const [source, targets] of adjacency) {
        if (targets.includes(current) && !includedPaths.has(source)) {
          includedPaths.add(source);
          queue.push({ path: source, currentDepth: currentDepth + 1 });
        }
      }
    }
  } else {
    includedPaths = indexedPaths;
  }

  // Build graph
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const filePath of includedPaths) {
    const file = fileMap.get(filePath);
    if (!file) continue;
    nodes.set(filePath, {
      path: file.path,
      name: file.name,
      language: file.language,
    });
  }

  for (const filePath of includedPaths) {
    const deps = adjacency.get(filePath) || [];
    for (const dep of deps) {
      if (includedPaths.has(dep)) {
        edges.push({ from: filePath, to: dep });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Generate Mermaid syntax from a dependency graph.
 */
export function generateMermaid(graph: DependencyGraph): string {
  const lines: string[] = ["graph LR"];

  // Create stable node IDs
  const nodeIds = new Map<string, string>();
  let idCounter = 0;
  for (const filePath of graph.nodes.keys()) {
    nodeIds.set(filePath, `N${idCounter++}`);
  }

  // Node declarations
  for (const [filePath, node] of graph.nodes) {
    const id = nodeIds.get(filePath)!;
    const label = node.path.replace(/"/g, "'");
    lines.push(`  ${id}["${label}"]`);
  }

  // Edge declarations
  for (const edge of graph.edges) {
    const fromId = nodeIds.get(edge.from);
    const toId = nodeIds.get(edge.to);
    if (fromId && toId) {
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  return lines.join("\n");
}

/**
 * Render a Mermaid diagram string to ASCII/Unicode art.
 */
export function renderGraphAscii(mermaid: string): string {
  return renderMermaidASCII(mermaid, { colorMode: "none" });
}

/**
 * Render a Mermaid diagram string to SVG.
 */
export function renderGraphSvg(mermaid: string): string {
  return renderMermaidSVG(mermaid, { transparent: true });
}
