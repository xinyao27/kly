#!/usr/bin/env bun

/**
 * Example: Permissions System Demo
 *
 * This example demonstrates how the permissions system protects sensitive resources.
 * When you run this example, you'll be prompted to grant permission for API key access.
 *
 * Prerequisites:
 * - Configure a model: `bun run bin/kly.ts models`
 *
 * Usage:
 * ```bash
 * # First run - will prompt for permission
 * bun run bin/kly.ts run examples/permissions-demo.ts
 *
 * # Skip permission prompt (for automation/testing)
 * KLY_TRUST_ALL=true bun run bin/kly.ts run examples/permissions-demo.ts
 *
 * # Manage permissions
 * bun run bin/kly.ts permissions
 * ```
 *
 * Security Features:
 * - First run: User must grant permission for API key access
 * - Can choose: "once", "always allow", or "deny"
 * - Permissions stored in ~/.kly/permissions.json
 * - Can revoke anytime via `kly permissions` command
 *
 * Protected Directories (Sandbox):
 * - ~/.kly - ALWAYS denied for read AND write
 * - ~/.ssh, ~/.aws, ~/.gnupg - Denied for write
 *
 * Try to read ~/.kly/permissions.json - you'll get "operation not permitted"!
 */

import { z } from "zod";
import { defineApp, tool } from "../src";
import { log, output } from "../src/ui";

const demoTool = tool({
  name: "demo",
  description: "Demo the permissions system by accessing model config",
  inputSchema: z.object({
    modelName: z
      .string()
      .optional()
      .describe("Model name (uses current if not specified)"),
  }),
  execute: async ({ modelName }, context) => {
    output("🔐 Permission Demo");

    // Note: In sandbox mode, synchronous methods like list() are not available
    // This is by design - all operations that might need host resources use async

    // Try to access API keys (requires permission)
    log.step("Requesting access to API keys...");

    try {
      const config = await context.models.getConfigAsync(modelName);

      if (!config) {
        output("No model configured");
        output("Run: bun run bin/kly.ts models");
        return { success: false, error: "No model configured" };
      }

      // Successfully got permission!
      log.success("Permission granted!");
      output(`Provider: ${config.provider}`);
      output(`Model: ${config.model || "default"}`);
      output(
        `API Key: ${config.apiKey ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}` : "not set"}`,
      );

      return {
        success: true,
        provider: config.provider,
        model: config.model,
      };
    } catch (err) {
      output("Permission denied");
      output(err instanceof Error ? err.message : "Permission denied");

      return {
        success: false,
        error: err instanceof Error ? err.message : "Permission denied",
      };
    }
  },
});

export default defineApp({
  name: "permissions-demo",
  version: "0.1.0",
  description: "Demo app showing how permissions system works",
  permissions: {
    // Simply declare: we need API keys
    // LLM API domains (OpenAI, Anthropic, Google, DeepSeek) are allowed automatically
    apiKeys: true,
  },
  tools: [demoTool],
});
