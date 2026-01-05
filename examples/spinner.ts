import { z } from "zod";
import { defineApp, tool } from "../src";
import { spinner } from "../src/ui";

// Helper to simulate async work
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const spinnerTool = tool({
  name: "loading-demo",
  description: "Spinner and loading state demonstrations",
  inputSchema: z.object({
    scenario: z
      .enum(["success", "failure", "progress", "multiple"])
      .default("success")
      .describe("Spinner scenario to demonstrate"),
  }),
  execute: async ({ scenario }) => {
    switch (scenario) {
      case "success": {
        const spin = spinner("Loading data...");
        await sleep(2000);
        spin.succeed("Data loaded successfully!");
        return { scenario, status: "completed" };
      }

      case "failure": {
        const spin = spinner("Connecting to server...");
        await sleep(1500);
        spin.fail("Connection failed!");
        return { scenario, status: "failed" };
      }

      case "progress": {
        const spin = spinner("Step 1: Preparing...");
        await sleep(1000);

        spin.update("Step 2: Processing...");
        await sleep(1500);

        spin.update("Step 3: Finalizing...");
        await sleep(1000);

        spin.succeed("All steps completed!");
        return { scenario, status: "completed", steps: 3 };
      }

      case "multiple": {
        // First task
        const spin1 = spinner("Downloading dependencies...");
        await sleep(1500);
        spin1.succeed("Dependencies downloaded");

        // Second task
        const spin2 = spinner("Building project...");
        await sleep(2000);
        spin2.succeed("Project built");

        // Third task
        const spin3 = spinner("Running tests...");
        await sleep(1000);
        spin3.succeed("All tests passed");

        return { scenario, status: "completed", tasks: 3 };
      }
    }
  },
});

defineApp({
  name: "spinner-example",
  version: "0.1.0",
  description: "Loading spinner and progress examples",
  tools: [spinnerTool],
});
