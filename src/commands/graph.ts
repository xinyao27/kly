import {
  type GraphFormat,
  buildDependencyGraph,
  generateMermaid,
  renderGraphAscii,
  renderGraphSvg,
} from "../graph";
import { openDatabase } from "../store";
import { type OutputOptions, error, output } from "./output";
import { ensureInitialized } from "./shared";

export interface GraphOptions extends OutputOptions {
  focus?: string;
  depth?: number;
  format?: GraphFormat;
}

function formatGraph(data: unknown): string {
  const graph = data as {
    nodes: Array<{ path: string; name: string; language: string }>;
    edges: Array<{ from: string; to: string }>;
  };

  if (graph.nodes.length === 0) {
    return "no files indexed yet. run `kly build` first.";
  }

  if (graph.edges.length === 0) {
    return "no dependencies found between indexed files.";
  }

  // Build adjacency: forward (imports) and reverse (imported by)
  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!forward.has(edge.from)) forward.set(edge.from, []);
    forward.get(edge.from)!.push(edge.to);
    if (!reverse.has(edge.to)) reverse.set(edge.to, []);
    reverse.get(edge.to)!.push(edge.from);
  }

  const lines: string[] = [`${graph.nodes.length} node(s), ${graph.edges.length} edge(s)`, ""];

  for (const node of graph.nodes) {
    lines.push(node.path);
    const deps = forward.get(node.path) || [];
    const dependents = reverse.get(node.path) || [];
    for (const d of deps) {
      lines.push(`  -> ${d}`);
    }
    for (const d of dependents) {
      lines.push(`  <- ${d}`);
    }
    if (deps.length === 0 && dependents.length === 0) {
      lines.push("  (no connections)");
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function runGraph(root: string, options: GraphOptions = {}): void {
  ensureInitialized(root);

  const depth = options.depth ?? 2;
  const format = options.format ?? (options.pretty ? "ascii" : "mermaid");

  const db = openDatabase(root);
  try {
    const graph = buildDependencyGraph(db, { focus: options.focus, depth });

    if (options.focus && !graph.nodes.has(options.focus)) {
      error(`File not in index: ${options.focus}`, `kly query "${options.focus.split("/").pop()}"`);
    }

    if (format === "mermaid" || format === "ascii" || format === "svg") {
      const mermaid = generateMermaid(graph);

      if (graph.nodes.size === 0) {
        console.log("no files indexed yet. run `kly build` first.");
        return;
      }
      if (graph.edges.length === 0) {
        console.log("no dependencies found between indexed files.");
        return;
      }

      switch (format) {
        case "mermaid":
          console.log(mermaid);
          break;
        case "ascii":
          console.log(renderGraphAscii(mermaid));
          break;
        case "svg":
          console.log(renderGraphSvg(mermaid));
          break;
      }
      return;
    }

    const data = {
      nodes: Array.from(graph.nodes.values()),
      edges: graph.edges,
    };

    output(data, options, formatGraph);
  } finally {
    db.close();
  }
}
