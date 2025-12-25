import { z } from "zod";
import { defineApp, tool } from "../src";
import { select } from "../src/ui";

const selectTool = tool({
  name: "menu-select",
  description: "Interactive select menu demonstrations",
  inputSchema: z.object({
    demo: z
      .enum(["colors", "languages", "priorities"])
      .default("colors")
      .describe("Type of select demo to run"),
  }),
  execute: async ({ demo }) => {
    let result: string | number;

    switch (demo) {
      case "colors":
        result = await select({
          prompt: "Pick your favorite color",
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
          prompt: "Which programming language?",
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
          prompt: "Set task priority",
          options: [
            { name: "High", value: 3, description: "Urgent task" },
            { name: "Medium", value: 2, description: "Normal task" },
            { name: "Low", value: 1, description: "Can wait" },
          ],
        });
        break;
    }

    return {
      demo,
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
