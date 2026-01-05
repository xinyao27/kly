import { z } from "zod";
import { defineApp, tool } from "../src";
import { confirm, input } from "../src/ui";

/**
 * Example: Interactive confirmation workflow
 *
 * This demonstrates when you SHOULD use interactive components in execute():
 * - First collect basic info via inputSchema (username)
 * - Then, based on logic, conditionally ask for more info using components
 *
 * This is different from putting everything in inputSchema because:
 * - The additional questions are conditional (only asked if user confirms)
 * - It creates a conversational flow rather than asking everything upfront
 */
const interactiveWorkflowTool = tool({
  name: "setup-profile",
  description: "Setup user profile with optional additional information",
  inputSchema: z.object({
    username: z.string().describe("Your username"),
  }),
  execute: async ({ username }, context) => {
    // Basic info collected via inputSchema
    const profile: Record<string, string> = { username };

    // In CLI mode: Ask if user wants to provide more info
    if (context.mode === "cli") {
      const wantsMore = await confirm("Would you like to add more profile information?", true);

      if (wantsMore) {
        // Conditionally collect additional data based on user's choice
        const email = await input({
          prompt: "What's your email address?",
          placeholder: "user@example.com",
        });
        profile.email = email;

        const bio = await input({
          prompt: "Tell us about yourself",
          placeholder: "Optional bio...",
          maxLength: 200,
        });
        if (bio) {
          profile.bio = bio;
        }
      }
    }
    // In MCP mode: Only use the username from inputSchema

    return {
      profile,
      message: `Profile created for ${username}`,
      fieldsProvided: Object.keys(profile).length,
    };
  },
});

defineApp({
  name: "input-example",
  version: "0.1.0",
  description: "Interactive input component examples - shows conditional data collection",
  tools: [interactiveWorkflowTool],
});
