import { z } from "zod";
import { defineApp, tool } from "../src";
import { select } from "../src/ui";

const selectTool = tool({
  name: "menu-select",
  description: "Select from a list of options",
  inputSchema: z.object({
    prompt: z.string().describe("The prompt message"),
    options: z
      .enum(["colors", "languages", "priorities"])
      .describe("Category of options"),
    value: z
      .union([z.string(), z.number()])
      .optional()
      .describe("Selected value (Claude provides this in MCP mode)"),
  }),
  execute: async ({ prompt, options, value }, context) => {
    let result: string | number;

    // In MCP mode: use the provided value
    if (context.mode === "mcp") {
      if (value !== undefined) {
        result = value;
      } else {
        // Default to first option if no value provided
        result = options === "priorities" ? 2 : "red";
      }
    } else {
      // In CLI mode: prompt for interactive selection
      switch (options) {
        case "colors":
          result = await select({
            prompt: prompt || "Pick your favorite color",
            options: [
              { name: "Red", value: "red", description: "Passionate and bold" },
              { name: "Blue", value: "blue", description: "Calm and serene" },
              {
                name: "Green",
                value: "green",
                description: "Natural and fresh",
              },
              {
                name: "Yellow",
                value: "yellow",
                description: "Cheerful and energetic",
              },
            ],
          });
          break;

        case "languages":
          result = await select({
            prompt: prompt || "Which programming language?",
            options: [
              {
                name: "TypeScript",
                value: "ts",
                description: "Type-safe JavaScript",
              },
              {
                name: "Rust",
                value: "rust",
                description: "Memory safe systems programming",
              },
              { name: "Go", value: "go", description: "Simple and fast" },
              { name: "Python", value: "py", description: "Easy and powerful" },
            ],
          });
          break;

        case "priorities":
          result = await select<number>({
            prompt: prompt || "Set task priority",
            options: [
              { name: "High", value: 3, description: "Urgent task" },
              { name: "Medium", value: 2, description: "Normal task" },
              { name: "Low", value: 1, description: "Can wait" },
            ],
          });
          break;
      }
    }

    return {
      category: options,
      selected: result,
      message: `You selected: ${result}`,
    };
  },
});

defineApp({
  name: "select-example",
  version: "0.1.0",
  description: "Interactive select menu examples",
  tools: [selectTool],
});
