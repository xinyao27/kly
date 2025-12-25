import { z } from "zod";
import { defineApp, tool } from "../src";
import { multiselect } from "../src/ui";

const multiselectTool = tool({
  name: "multi-select",
  description: "Interactive multi-select menu demonstrations",
  inputSchema: z.object({
    demo: z
      .enum(["features", "skills", "toppings"])
      .default("features")
      .describe("Type of multiselect demo to run"),
  }),
  execute: async ({ demo }) => {
    let result: string[];

    switch (demo) {
      case "features":
        result = await multiselect({
          prompt: "Which features do you want to enable?",
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
          prompt: "Select your skills",
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
          prompt: "Choose pizza toppings",
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

    return {
      demo,
      selected: result,
      count: result.length,
    };
  },
});

defineApp({
  name: "multiselect-example",
  version: "0.1.0",
  description: "Interactive multi-select examples",
  tools: [multiselectTool],
});
