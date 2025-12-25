import { z } from "zod";
import { defineApp, tool } from "../src";
import { input } from "../src/ui";

const inputTool = tool({
  name: "text-input",
  description: "Prompt for user input with various configurations",
  inputSchema: z.object({
    mode: z
      .enum(["simple", "default", "placeholder", "maxlength"])
      .default("simple")
      .describe("Input mode to demonstrate"),
  }),
  execute: async ({ mode }) => {
    let result: string;

    switch (mode) {
      case "simple":
        result = await input({
          prompt: "What is your name?",
        });
        break;

      case "default":
        result = await input({
          prompt: "Enter your username",
          defaultValue: "guest",
        });
        break;

      case "placeholder":
        result = await input({
          prompt: "Enter your email",
          placeholder: "user@example.com",
        });
        break;

      case "maxlength":
        result = await input({
          prompt: "Enter a short code",
          placeholder: "Max 6 characters",
          maxLength: 6,
        });
        break;
    }
    return {
      mode,
      input: result,
      message: `You entered: ${result}`,
    };
  },
});

defineApp({
  name: "input-example",
  version: "0.1.0",
  description: "Interactive input component examples",
  tools: [inputTool],
});
