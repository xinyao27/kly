/* agent-frontmatter:start
AGENT: Hello world example app
PURPOSE: Demonstrate basic defineApp usage with tool
USAGE: bun run examples/hello.ts --name=World
EXPORTS: none (CLI app)
FEATURES:
  - Single tool wrapped in defineApp (no subcommand needed)
  - String and boolean parameters
  - Simple greeting output
SEARCHABLE: example, hello, demo
agent-frontmatter:end */

import { z } from "zod";
import { defineApp, tool } from "../src";

const greetTool = tool({
  name: "greet",
  description: "Say hello to someone",
  inputSchema: z.object({
    name: z.string().describe("Name to greet"),
    excited: z.boolean().default(false).describe("Add exclamation mark"),
  }),
  execute: async ({ name, excited }) => {
    const mark = excited ? "!" : ".";
    return `Hello, ${name}${mark}`;
  },
});

defineApp({
  name: "hello",
  version: "0.1.0",
  description: "Hello world CLI",
  tools: [greetTool],
});
