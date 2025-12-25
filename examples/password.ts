import { z } from "zod";
import { defineApp, tool } from "../src";
import { log, password } from "../src/ui";

const passwordTool = tool({
  name: "secret-input",
  description:
    "Handle secure password and secret input (Use environment variables for secrets in MCP mode)",
  inputSchema: z.object({
    type: z.enum(["password", "apikey", "token"]).describe("Type of secret"),
    // In MCP mode, secrets should come from environment variables, not schema
    useEnvVar: z
      .boolean()
      .default(true)
      .describe("Use environment variable (recommended for MCP mode)"),
    envVarName: z
      .string()
      .optional()
      .describe("Environment variable name to read from"),
  }),
  execute: async ({ type, useEnvVar, envVarName }, context) => {
    let secret: string;
    let masked: string;

    // In MCP mode: always use environment variables for security
    if (context.mode === "mcp" || useEnvVar) {
      const varName = envVarName || `${type.toUpperCase()}_SECRET`;
      secret = process.env[varName] || "";

      if (!secret) {
        throw new Error(
          `Environment variable ${varName} not set. For security, passwords and secrets should be provided via environment variables in MCP mode.`,
        );
      }

      masked = "*".repeat(Math.min(secret.length, 20));
      log.success(`${type} loaded from ${varName}`);
    } else {
      // In CLI mode: prompt for interactive password input
      switch (type) {
        case "password":
          secret = await password({
            prompt: "Enter your password",
            validate: (value) => {
              if (!value || value.length < 8) {
                return "Password must be at least 8 characters";
              }
              return undefined;
            },
          });
          masked = "*".repeat(secret.length);
          log.success("Password accepted");
          break;

        case "apikey":
          secret = await password({
            prompt: "Enter your API key",
            mask: "*",
            validate: (value) => {
              if (!value || !value.startsWith("sk-")) {
                return "API key should start with 'sk-'";
              }
              return undefined;
            },
          });
          masked = `sk-${"*".repeat(secret.length - 3)}`;
          log.success("API key validated");
          break;

        case "token":
          secret = await password({
            prompt: "Enter access token",
            mask: "x",
          });
          masked = `${"x".repeat(Math.min(secret.length, 20))}...`;
          log.success("Token received");
          break;
      }
    }

    return {
      type,
      masked,
      length: secret.length,
      source:
        context.mode === "mcp" || useEnvVar ? "environment" : "interactive",
    };
  },
});

defineApp({
  name: "password-example",
  version: "0.1.0",
  description: "Secure password input examples",
  tools: [passwordTool],
});
