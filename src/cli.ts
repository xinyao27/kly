#!/usr/bin/env node
import { Command } from "commander";

import { runBuild } from "./commands/build.js";
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
  .description("Build file index")
  .option("-i, --incremental", "Only index changed files")
  .action(async (options: { incremental?: boolean }) => {
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

program.parse();
