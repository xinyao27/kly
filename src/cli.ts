#!/usr/bin/env node
import { Command } from "commander";

import { runBuild } from "./commands/build.js";
import { runGc } from "./commands/gc.js";
import { runHook } from "./commands/hook.js";
import { runInit } from "./commands/init.js";
import { runQuery } from "./commands/query.js";
import { runServe } from "./commands/serve.js";
import { runShow } from "./commands/show.js";

const program = new Command();

program.name("kly").description("Code repository file-level indexing tool").version("0.1.0");

program
  .command("init")
  .description("Initialize .kly/ directory")
  .action(async () => {
    await runInit(process.cwd());
  });

program
  .command("build")
  .description("Build file index (git-incremental by default in git repos)")
  .option("--full", "Force full rebuild")
  .option("--quiet", "Suppress output (for git hooks)")
  .action(async (options: { full?: boolean; quiet?: boolean }) => {
    await runBuild(process.cwd(), options);
  });

program
  .command("query <description>")
  .description("Search files by description")
  .action((description: string) => {
    runQuery(process.cwd(), description);
  });

program
  .command("show <path>")
  .description("Show file index details")
  .action((filePath: string) => {
    runShow(process.cwd(), filePath);
  });

program
  .command("serve")
  .description("Start MCP server (stdio)")
  .action(async () => {
    await runServe(process.cwd());
  });

program
  .command("hook")
  .description("Manage git hooks")
  .argument("<action>", "install or uninstall")
  .action((action: string) => {
    runHook(process.cwd(), action);
  });

program
  .command("gc")
  .description("Clean up databases for deleted branches")
  .action(() => {
    runGc(process.cwd());
  });

program.parse();
