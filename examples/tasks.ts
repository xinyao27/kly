import { z } from "zod";
import { defineApp, tool } from "../src";
import { intro, log, outro, tasks } from "../src/ui";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const tasksTool = tool({
  name: "tasks-demo",
  description: "Sequential tasks with spinners demonstrations",
  inputSchema: z.object({
    scenario: z
      .enum(["setup", "deploy", "cleanup"])
      .default("setup")
      .describe("Task scenario to demonstrate"),
  }),
  execute: async ({ scenario }) => {
    intro(`Running ${scenario} tasks`);

    switch (scenario) {
      case "setup": {
        const results = await tasks([
          {
            title: "Installing dependencies",
            task: async (message) => {
              message("Reading package.json...");
              await sleep(500);
              message("Fetching packages...");
              await sleep(1000);
              return { packages: 42 };
            },
          },
          {
            title: "Setting up configuration",
            task: async (message) => {
              message("Creating config files...");
              await sleep(800);
              return { files: ["tsconfig.json", ".eslintrc"] };
            },
          },
          {
            title: "Initializing git repository",
            task: async () => {
              await sleep(500);
              return { branch: "main" };
            },
          },
        ]);

        outro("Setup complete!");
        return { scenario, results };
      }

      case "deploy": {
        const results = await tasks([
          {
            title: "Building application",
            task: async (message) => {
              message("Compiling TypeScript...");
              await sleep(800);
              message("Bundling assets...");
              await sleep(600);
              return { bundle: "dist/index.js" };
            },
          },
          {
            title: "Running tests",
            task: async (message) => {
              message("Running unit tests...");
              await sleep(700);
              message("Running integration tests...");
              await sleep(500);
              return { passed: 24, failed: 0 };
            },
          },
          {
            title: "Deploying to production",
            task: async (message) => {
              message("Uploading files...");
              await sleep(1000);
              message("Updating DNS...");
              await sleep(500);
              return { url: "https://app.example.com" };
            },
          },
        ]);

        outro("Deployment successful!");
        return { scenario, results };
      }

      case "cleanup": {
        const results = await tasks([
          {
            title: "Removing build artifacts",
            task: async () => {
              await sleep(400);
              return { removed: ["dist/", ".cache/"] };
            },
          },
          {
            title: "Clearing caches",
            task: async () => {
              await sleep(300);
              return { cleared: true };
            },
          },
          {
            title: "Optional: Remove node_modules",
            task: async () => {
              await sleep(200);
              return { skipped: true };
            },
            enabled: false, // Disabled by default
          },
        ]);

        log.success("Cleanup finished");
        return { scenario, results };
      }
    }
  },
});

defineApp({
  name: "tasks-example",
  version: "0.1.0",
  description: "Sequential task runner examples",
  tools: [tasksTool],
});
