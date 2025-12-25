import { z } from "zod";
import { defineApp, tool } from "../src";
import { log, password } from "../src/ui";

const passwordTool = tool({
  name: "secret-input",
  description: "Secure password and secret input demonstrations",
  inputSchema: z.object({
    type: z
      .enum(["password", "apikey", "token"])
      .default("password")
      .describe("Type of secret to input"),
  }),
  execute: async ({ type }) => {
    let secret: string;
    let masked: string;

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

    return {
      type,
      masked,
      length: secret.length,
    };
  },
});

defineApp({
  name: "password-example",
  version: "0.1.0",
  description: "Secure password input examples",
  tools: [passwordTool],
});
