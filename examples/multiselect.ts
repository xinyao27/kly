import { z } from "zod";
import { defineApp, tool } from "../src";
import { multiselect } from "../src/ui";

const multiselectTool = tool({
  name: "multi-select",
  description: "Select multiple items from a list",
  inputSchema: z.object({
    prompt: z.string().describe("The prompt message"),
    category: z
      .enum(["features", "skills", "toppings"])
      .describe("Category of options"),
    values: z
      .array(z.string())
      .optional()
      .describe("Selected values (Claude provides this in MCP mode)"),
  }),
  execute: async ({ prompt, category, values }, context) => {
    let result: string[];

    // In MCP mode: use the provided values
    if (context.mode === "mcp") {
      result = values ?? [];
    } else {
      // In CLI mode: prompt for interactive multi-selection
      switch (category) {
        case "features":
          result = await multiselect({
            prompt: prompt || "Which features do you want to enable?",
            options: [
              {
                name: "TypeScript",
                value: "typescript",
                description: "Type safety",
              },
              { name: "ESLint", value: "eslint", description: "Code linting" },
              {
                name: "Prettier",
                value: "prettier",
                description: "Code formatting",
              },
              { name: "Vitest", value: "vitest", description: "Unit testing" },
            ],
          });
          break;

        case "skills":
          result = await multiselect({
            prompt: prompt || "Select your skills",
            options: [
              { name: "JavaScript", value: "js" },
              { name: "TypeScript", value: "ts" },
              { name: "React", value: "react" },
              { name: "Vue", value: "vue" },
              { name: "Node.js", value: "node" },
            ],
            initialValues: ["js"],
          });
          break;

        case "toppings":
          result = await multiselect({
            prompt: prompt || "Choose pizza toppings",
            options: [
              { name: "Pepperoni", value: "pepperoni" },
              { name: "Mushrooms", value: "mushrooms" },
              { name: "Olives", value: "olives" },
              { name: "Onions", value: "onions" },
              { name: "Extra Cheese", value: "cheese" },
            ],
            required: true,
          });
          break;
      }
    }

    return {
      category,
      selected: result,
      count: result.length,
      message: `Selected ${result.length} items: ${result.join(", ")}`,
    };
  },
});

defineApp({
  name: "multiselect-example",
  version: "0.1.0",
  description: "Interactive multi-select examples",
  tools: [multiselectTool],
});
