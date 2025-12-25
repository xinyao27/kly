import { z } from "zod";
import { defineApp, tool } from "../src";
import { input } from "../src/ui";

const inputTool = tool({
  name: "text-input",
  description: "Get text input from user",
  inputSchema: z.object({
    prompt: z.string().describe("The prompt message to show"),
    value: z
      .string()
      .optional()
      .describe(
        "The value to use (in MCP mode, this is provided by Claude; in CLI mode, user is prompted)",
      ),
    defaultValue: z
      .string()
      .optional()
      .describe("Default value if no input provided"),
    placeholder: z.string().optional().describe("Placeholder text"),
    maxLength: z.number().optional().describe("Maximum length of input"),
  }),
  execute: async (
    { prompt, value, defaultValue, placeholder, maxLength },
    context,
  ) => {
    let result: string;

    // In MCP mode: use the provided value from schema
    if (context.mode === "mcp") {
      result = value ?? defaultValue ?? "";
    } else {
      // In CLI mode: prompt for interactive input
      result = await input({
        prompt,
        defaultValue,
        placeholder,
        maxLength,
      });
    }

    return {
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
