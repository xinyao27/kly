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

const SUPPORTED_FORMATS = new Set<GraphOptions["format"]>(["ascii", "svg", "mermaid"]);

function validateGraphOptions(options: GraphOptions): { depth: number; format: GraphOptions["format"] } {
  const depth = options.depth ?? 2;
  if (!Number.isInteger(depth) || depth < 1) {
    p.log.error("`--depth` must be a positive integer.");
    process.exit(1);
  }

  const format = options.format ?? "ascii";
  if (!SUPPORTED_FORMATS.has(format)) {
    p.log.error("`--format` must be one of: ascii, mermaid, svg.");
    process.exit(1);
  }

  return { depth, format };
}

export async function runGraph(root: string, options: GraphOptions): Promise<void> {
  ensureInitialized(root);

  const { depth, format } = validateGraphOptions(options);

  const db = openDatabase(root);
  try {
    const graph = buildDependencyGraph(db, { focus: options.focus, depth });

    if (options.focus && !graph.nodes.has(options.focus)) {
      p.log.warn(`Focused file is not indexed: ${options.focus}`);
      return;
    }

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
