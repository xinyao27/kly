import { z } from "zod";
import { defineApp, tool } from "../src";
import { error, intro, log, note, outro } from "../src/ui";

const logTool = tool({
  name: "log-demo",
  description: "Logging and message output demonstrations",
  inputSchema: z.object({
    demo: z.enum(["all", "workflow", "errors"]).default("all").describe("Type of log demo to run"),
  }),
  execute: async ({ demo }) => {
    switch (demo) {
      case "all":
        intro("Log Types Demo");

        log.message("This is a general message");
        log.info("This is an info message");
        log.step("This is a step message");
        log.success("This is a success message");
        log.warn("This is a warning message");
        error("This is an error message");

        note("You can also display notes\nwith multiple lines", "Note Title");

        outro("Demo complete");
        return { demo, types: 6 };

      case "workflow":
        intro("Project Setup");

        log.step("Checking prerequisites");
        log.info("Node.js v20.0.0 detected");
        log.info("npm v10.0.0 detected");

        log.step("Installing dependencies");
        log.success("Dependencies installed");

        log.step("Configuring project");
        log.warn("Using default configuration");

        note("Run `npm run dev` to start\nRun `npm run build` to build", "Next Steps");

        outro("Setup complete!");
        return { demo, steps: 3 };

      case "errors":
        intro("Error Handling Demo");

        log.info("Starting validation...");
        log.warn("Config file not found, using defaults");
        error("Failed to connect to database");
        log.step("Retrying with fallback...");
        log.success("Connected to fallback database");

        outro("Recovery complete");
        return { demo, recovered: true };
    }
  },
});

defineApp({
  name: "log-example",
  version: "0.1.0",
  description: "Logging and output examples",
  tools: [logTool],
});
