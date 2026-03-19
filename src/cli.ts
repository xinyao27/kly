#!/usr/bin/env node
import { Command } from "commander";

import { runBuild } from "./commands/build";
import { runGc } from "./commands/gc";
import { runGraph } from "./commands/graph";
import { runHook } from "./commands/hook";
import { runInit } from "./commands/init";
import { runOverview } from "./commands/overview";
import { runQuery } from "./commands/query";
import { runServe } from "./commands/serve";
import { runShow } from "./commands/show";

const program = new Command();

program
  .name("kly")
  .description("Code repository file-level indexing tool")
  .version("0.1.0")
  .showHelpAfterError()
  .showSuggestionAfterError();

program
  .command("init")
  .description("Initialize kly in the current repository")
  .action(async () => {
    await runInit(process.cwd());
  });

program
  .command("build")
  .description("Build or update the repository index")
  .option("--full", "Force full rebuild")
  .option("--quiet", "Suppress output (for git hooks)")
  .action(async (options: { full?: boolean; quiet?: boolean }) => {
    await runBuild(process.cwd(), options);
  });

program
  .command("query <description>")
  .description("Search indexed files with natural language")
  .option("--rerank", "Use LLM to rerank results for better relevance")
  .action(async (description: string, options: { rerank?: boolean }) => {
    await runQuery(process.cwd(), description, options);
  });

program
  .command("show <path>")
  .description("Show indexed metadata for a file")
  .action((filePath: string) => {
    runShow(process.cwd(), filePath);
  });

program
  .command("graph")
  .description("Render the indexed file dependency graph")
  .option("--focus <path>", "Focus the graph on a specific file")
  .option("--depth <n>", "Maximum dependency depth", "2")
  .option("--format <format>", "Output format: ascii, mermaid, svg", "ascii")
  .action(async (options: { focus?: string; depth: string; format: string }) => {
    await runGraph(process.cwd(), {
      focus: options.focus,
      depth: parseInt(options.depth, 10),
      format: options.format as "ascii" | "svg" | "mermaid",
    });
  });

program
  .command("overview")
  .description("Show an indexed repository summary")
  .action(() => {
    runOverview(process.cwd());
  });

program
  .command("mcp")
  .description("Start the MCP server over stdio")
  .action(async () => {
    await runServe(process.cwd());
  });

program
  .command("hook")
  .description("Install or uninstall the post-commit hook")
  .argument("<action>", "install | uninstall")
  .action((action: string) => {
    runHook(process.cwd(), action);
  });

program
  .command("gc")
  .description("Remove databases for deleted git branches")
  .action(() => {
    runGc(process.cwd());
  });

program.parse();
