import { z } from "zod";
import { defineApp, tool } from "../src";
import { form } from "../src/ui";

const formTool = tool({
  name: "multi-form",
  description: "Multi-field form demonstrations",
  inputSchema: z.object({
    type: z
      .enum(["user-registration", "project-setup", "survey"])
      .default("user-registration")
      .describe("Type of form to display"),
  }),
  execute: async ({ type }) => {
    let values: Record<string, unknown>;

    switch (type) {
      case "user-registration":
        values = await form({
          title: "User Registration",
          fields: [
            {
              name: "username",
              label: "Username",
              type: "string",
              required: true,
              description: "Your unique username",
            },
            {
              name: "email",
              label: "Email",
              type: "string",
              required: true,
              description: "Contact email address",
            },
            {
              name: "age",
              label: "Age",
              type: "number",
              defaultValue: 18,
            },
            {
              name: "role",
              label: "Role",
              type: "enum",
              enumValues: ["admin", "editor", "viewer"],
              defaultValue: "viewer",
            },
            {
              name: "newsletter",
              label: "Subscribe to newsletter?",
              type: "boolean",
            },
          ],
        });
        break;

      case "project-setup":
        values = await form({
          title: "New Project Setup",
          fields: [
            {
              name: "projectName",
              label: "Project name",
              type: "string",
              required: true,
            },
            {
              name: "framework",
              label: "Framework",
              type: "enum",
              enumValues: ["React", "Vue", "Svelte", "Vanilla"],
            },
            {
              name: "typescript",
              label: "Use TypeScript?",
              type: "boolean",
            },
            {
              name: "port",
              label: "Development port",
              type: "number",
              defaultValue: 3000,
            },
            {
              name: "git",
              label: "Initialize Git repository?",
              type: "boolean",
            },
          ],
        });
        break;

      case "survey":
        values = await form({
          title: "Quick Survey",
          fields: [
            {
              name: "satisfaction",
              label: "How satisfied are you?",
              type: "enum",
              enumValues: [
                "Very Satisfied",
                "Satisfied",
                "Neutral",
                "Dissatisfied",
              ],
            },
            {
              name: "rating",
              label: "Rate from 1-10",
              type: "number",
              defaultValue: 5,
            },
            {
              name: "recommend",
              label: "Would you recommend us?",
              type: "boolean",
            },
            {
              name: "feedback",
              label: "Additional feedback",
              type: "string",
              required: false,
            },
          ],
        });
        break;
    }

    return {
      type,
      values,
      message: "Form submitted successfully!",
    };
  },
});

defineApp({
  name: "form-example",
  version: "0.1.0",
  description: "Multi-field form examples",
  tools: [formTool],
});
