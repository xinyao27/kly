import * as p from "@clack/prompts";
import { renderMermaidASCII } from "beautiful-mermaid";

import { buildDependencyGraph, generateMermaid } from "../graph";
import { openDatabase } from "../store";
import { ensureInitialized } from "./shared";

export interface GraphOptions {
  focus?: string;
  depth?: number;
  format?: "ascii" | "svg" | "mermaid";
}

export async function runGraph(root: string, options: GraphOptions): Promise<void> {
  ensureInitialized(root);

  const format = options.format || "ascii";
  const depth = options.depth ?? 2;

  const db = openDatabase(root);
  try {
    const graph = buildDependencyGraph(db, { focus: options.focus, depth });

    if (graph.nodes.size === 0) {
      p.log.warn("No files indexed yet. Run `kly build` first.");
      return;
    }

    if (graph.edges.length === 0) {
      p.log.warn("No dependencies found between indexed files.");
      return;
    }

    const mermaidCode = generateMermaid(graph);

    switch (format) {
      case "mermaid":
        process.stdout.write(mermaidCode + "\n");
        break;
      case "svg": {
        const { renderMermaidSVG, THEMES } = await import("beautiful-mermaid");
        const svg = renderMermaidSVG(mermaidCode, THEMES["github-dark"]);
        process.stdout.write(svg + "\n");
        break;
      }
      case "ascii":
      default: {
        const ascii = renderMermaidASCII(mermaidCode);
        process.stdout.write(ascii + "\n");
        break;
      }
    }
  } finally {
    db.close();
  }
}
