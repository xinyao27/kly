import { z } from "zod";
import { defineApp, tool } from "../src";
import { createProgress, log } from "../src/ui";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const progressTool = tool({
  name: "progress-demo",
  description: "Progress bar demonstrations",
  inputSchema: z.object({
    scenario: z
      .enum(["download", "install", "build"])
      .default("download")
      .describe("Progress scenario to demonstrate"),
  }),
  execute: async ({ scenario }) => {
    switch (scenario) {
      case "download": {
        log.step("Starting download...");
        const progress = createProgress({
          total: 100,
          message: "Downloading file...",
        });

        for (let i = 0; i <= 100; i += 5) {
          await sleep(100);
          progress.update(i, `Downloading... ${i}%`);
        }

        progress.complete("Download complete!");
        return { scenario, status: "downloaded", size: "15.3 MB" };
      }

      case "install": {
        log.step("Installing packages...");
        const packages = ["react", "typescript", "vite", "eslint", "prettier"];
        const progress = createProgress({
          total: packages.length,
          width: 25,
        });

        for (let i = 0; i < packages.length; i++) {
          await sleep(500);
          progress.update(i + 1, `Installing ${packages[i]}...`);
        }

        progress.complete("All packages installed!");
        return { scenario, status: "installed", packages: packages.length };
      }

      case "build": {
        log.step("Building project...");
        const steps = [
          "Compiling TypeScript",
          "Bundling modules",
          "Minifying code",
          "Generating sourcemaps",
          "Writing output",
        ];
        const progress = createProgress({ total: steps.length });

        for (let i = 0; i < steps.length; i++) {
          await sleep(400);
          progress.update(i + 1, steps[i]);
        }

        progress.complete("Build successful!");
        return { scenario, status: "built", steps: steps.length };
      }
    }
  },
});

defineApp({
  name: "progress-example",
  version: "0.1.0",
  description: "Progress bar examples",
  permissions: {
    // Simple UI demo, no special permissions needed
  },
  tools: [progressTool],
});
