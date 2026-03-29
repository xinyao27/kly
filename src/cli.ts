#!/usr/bin/env node
import { createRequire } from "node:module";

import { Command } from "commander";

import { runBuild } from "./commands/build";
import { runDependents } from "./commands/dependents";
import { runEnrich } from "./commands/enrich";
import { runGc } from "./commands/gc";
import { runGraph } from "./commands/graph";
import { runHistory } from "./commands/history";
import { runHook } from "./commands/hook";
import { runInit } from "./commands/init";
import { runOverview } from "./commands/overview";
import { runQuery } from "./commands/query";
import { runShow } from "./commands/show";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("kly")
  .description("Code repository file-level indexing tool")
  .version(version)
  .showHelpAfterError()
  .showSuggestionAfterError();

// --- init ---

program
  .command("init")
  .description("Initialize kly in the current repository")
  .option(
    "--provider <name>",
    "LLM provider (openrouter, anthropic, openai, google, mistral, groq)",
  )
  .option("--model <name>", "Model name (default: provider-specific)")
  .option("--api-key <key>", "API key (or set via env variable)")
  .option("--hook", "Also install post-commit hook")
  .option("--include <glob...>", "File include patterns")
  .option("--exclude <glob...>", "File exclude patterns")
  .addHelpText(
    "after",
    `
Examples:
  kly init --provider openrouter --api-key sk-or-xxx
  kly init --provider anthropic --model claude-haiku-4.5 --api-key sk-ant-xxx --hook
  kly init                          # interactive mode (no flags)
`,
  )
  .action(async (options) => {
    await runInit(process.cwd(), options);
  });

// --- build ---

program
  .command("build")
  .description("Build or update the repository index")
  .option("--full", "Force full rebuild")
  .option("--quiet", "Suppress output (for git hooks)")
  .addHelpText(
    "after",
    `
Examples:
  kly build                    # incremental build
  kly build --full             # full rebuild
  kly build --full --quiet     # CI / git hook mode
`,
  )
  .action(async (options: { full?: boolean; quiet?: boolean }) => {
    await runBuild(process.cwd(), options);
  });

// --- query ---

program
  .command("query <text>")
  .description("Search indexed files by natural language description")
  .option("--rerank", "Use LLM to rerank results for better relevance")
  .option("--limit <n>", "Maximum results", "10")
  .option("--pretty", "Human-readable output")
  .addHelpText(
    "after",
    `
Examples:
  kly query "authentication middleware"
  kly query "error handling" --limit 5
  kly query "database migration" --rerank
  kly query "auth" --pretty
`,
  )
  .action(async (text: string, options: { rerank?: boolean; limit?: string; pretty?: boolean }) => {
    await runQuery(process.cwd(), text, {
      rerank: options.rerank,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      pretty: options.pretty,
    });
  });

// --- show ---

program
  .command("show <path>")
  .description("Show indexed metadata for a file")
  .option("--pretty", "Human-readable output")
  .addHelpText(
    "after",
    `
Examples:
  kly show src/auth.ts
  kly show src/auth.ts --pretty
`,
  )
  .action((filePath: string, options: { pretty?: boolean }) => {
    runShow(process.cwd(), filePath, options);
  });

// --- overview ---

program
  .command("overview")
  .description("Show repository index summary with language breakdown")
  .option("--pretty", "Human-readable output")
  .addHelpText(
    "after",
    `
Examples:
  kly overview
  kly overview --pretty
`,
  )
  .action((options: { pretty?: boolean }) => {
    runOverview(process.cwd(), options);
  });

// --- graph ---

program
  .command("graph")
  .description("Show file dependency graph")
  .option("--focus <path>", "Focus on a specific file")
  .option("--depth <n>", "Traversal depth", "2")
  .option(
    "--format <type>",
    "Output format: mermaid, json, ascii, svg (default: mermaid, or ascii with --pretty)",
  )
  .option("--pretty", "Human-readable output")
  .addHelpText(
    "after",
    `
Examples:
  kly graph
  kly graph --format ascii
  kly graph --format svg --focus src/auth.ts --depth 3
  kly graph --format mermaid
  kly graph --pretty
`,
  )
  .action((options: { focus?: string; depth?: string; format?: string; pretty?: boolean }) => {
    runGraph(process.cwd(), {
      focus: options.focus,
      depth: options.depth ? parseInt(options.depth, 10) : undefined,
      format: options.format as "json" | "mermaid" | "ascii" | "svg" | undefined,
      pretty: options.pretty,
    });
  });

// --- dependents ---

program
  .command("dependents <path>")
  .description("Show files that import the given file (reverse dependencies)")
  .option("--pretty", "Human-readable output")
  .addHelpText(
    "after",
    `
Examples:
  kly dependents src/database.ts
  kly dependents src/types.ts --pretty
`,
  )
  .action((filePath: string, options: { pretty?: boolean }) => {
    runDependents(process.cwd(), filePath, options);
  });

// --- history ---

program
  .command("history <path>")
  .description("Show recent git modification history for a file")
  .option("--limit <n>", "Number of commits", "5")
  .option("--pretty", "Human-readable output")
  .addHelpText(
    "after",
    `
Examples:
  kly history src/auth.ts
  kly history src/auth.ts --limit 10
  kly history src/auth.ts --pretty
`,
  )
  .action((filePath: string, options: { limit?: string; pretty?: boolean }) => {
    runHistory(process.cwd(), filePath, {
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      pretty: options.pretty,
    });
  });

// --- enrich ---

program
  .command("enrich")
  .description("Enrich error stack frames with file descriptions, dependencies, and git history")
  .option("--frames <json>", "Error frames as JSON string")
  .addHelpText(
    "after",
    `
Input: JSON array of ErrorFrame objects via --frames or stdin.
Each frame: { "file": "path", "line": number, "column?": number, "function?": "name" }

Examples:
  echo '[{"file":"src/auth.ts","line":42}]' | kly enrich
  kly enrich --frames '[{"file":"src/auth.ts","line":42,"function":"validate"}]'
  cat error-frames.json | kly enrich
`,
  )
  .action(async (options: { frames?: string }) => {
    await runEnrich(process.cwd(), options);
  });

// --- hook ---

program
  .command("hook <action>")
  .description("Install or uninstall the post-commit hook")
  .addHelpText(
    "after",
    `
Examples:
  kly hook install
  kly hook uninstall
`,
  )
  .action((action: string) => {
    runHook(process.cwd(), action);
  });

// --- gc ---

program
  .command("gc")
  .description("Remove databases for deleted git branches")
  .addHelpText(
    "after",
    `
Examples:
  kly gc
`,
  )
  .action(() => {
    runGc(process.cwd());
  });

await program.parseAsync();
