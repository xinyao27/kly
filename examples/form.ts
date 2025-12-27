import { z } from "zod";
import { defineApp, tool } from "../src";
import { form } from "../src/ui";

const formTool = tool({
  name: "multi-form",
  description: "Collect multiple form fields",
  inputSchema: z.object({
    formType: z
      .enum(["user-registration", "project-setup", "survey"])
      .describe("Type of form"),
    // Define all possible fields that might be needed
    username: z.string().optional().describe("Username for registration"),
    email: z.string().optional().describe("Email address"),
    age: z.number().optional().describe("User age"),
    role: z
      .enum(["admin", "editor", "viewer"])
      .optional()
      .describe("User role"),
    newsletter: z.boolean().optional().describe("Subscribe to newsletter"),
    projectName: z.string().optional().describe("Project name"),
    framework: z
      .enum(["React", "Vue", "Svelte", "Vanilla"])
      .optional()
      .describe("Framework choice"),
    typescript: z.boolean().optional().describe("Use TypeScript"),
    port: z.number().optional().describe("Development port"),
    git: z.boolean().optional().describe("Initialize Git repository"),
    satisfaction: z
      .enum(["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"])
      .optional()
      .describe("Satisfaction level"),
    rating: z.number().optional().describe("Rating from 1-10"),
    recommend: z.boolean().optional().describe("Would recommend"),
    feedback: z.string().optional().describe("Additional feedback"),
  }),
  execute: async (args, context) => {
    const { formType, ...providedValues } = args;
    let values: Record<string, unknown>;

    // In MCP mode: use the provided values from schema
    if (context.mode === "mcp") {
      // Filter out undefined values
      values = Object.fromEntries(
        Object.entries(providedValues).filter(([_, v]) => v !== undefined),
      );
    } else {
      // In CLI mode: prompt for interactive form input
      switch (formType) {
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
              { name: "age", label: "Age", type: "number", defaultValue: 18 },
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
              { name: "typescript", label: "Use TypeScript?", type: "boolean" },
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
    }

    return {
      formType,
      values,
      message: "Form submitted successfully!",
      fieldCount: Object.keys(values).length,
    };
  },
});

defineApp({
  name: "form-example",
  version: "0.1.0",
  description: "Multi-field form examples",
  permissions: {
    // Simple UI demo, no special permissions needed
  },
  tools: [formTool],
});
