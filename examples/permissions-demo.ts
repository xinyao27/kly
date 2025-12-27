#!/usr/bin/env bun

/**
 * Example: Permissions System Demo
 *
 * This example demonstrates how the permissions system protects sensitive resources.
 * When you run this example, you'll be prompted to grant permission for API key access.
 *
 * Prerequisites:
 * - Configure a model: `bun run bin/clai.ts models`
 *
 * Usage:
 * ```bash
 * # First run - will prompt for permission
 * bun run bin/clai.ts run examples/permissions-demo.ts
 *
 * # Skip permission prompt (for automation/testing)
 * CLAI_TRUST_ALL=true bun run bin/clai.ts run examples/permissions-demo.ts
 *
 * # Manage permissions
 * bun run bin/clai.ts permissions
 * ```
 *
 * Security Features:
 * - First run: User must grant permission for API key access
 * - Can choose: "once", "always allow", or "deny"
 * - Permissions stored in ~/.clai/permissions.json
 * - Can revoke anytime via `clai permissions` command
 *
 * Protected Directories (Sandbox):
 * - ~/.clai - ALWAYS denied for read AND write
 * - ~/.ssh, ~/.aws, ~/.gnupg - Denied for write
 *
 * Try to read ~/.clai/permissions.json - you'll get "operation not permitted"!
 */

import { z } from "zod";
import { defineApp, tool } from "../src";

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
    console.log("\n🔐 Permission Demo\n");

    // Note: In sandbox mode, synchronous methods like list() are not available
    // This is by design - all operations that might need host resources use async

    // Try to access API keys (requires permission)
    console.log("🔑 Requesting access to API keys...");
    console.log("   This requires user permission.\n");

    try {
      const config = await context.models.getConfigAsync(modelName);

      if (!config) {
        console.log("❌ No model configured\n");
        console.log("Run: bun run bin/clai.ts models\n");
        return { success: false, error: "No model configured" };
      }

      // Successfully got permission!
      console.log("✅ Permission granted!\n");
      console.log(`Provider: ${config.provider}`);
      console.log(`Model: ${config.model || "default"}`);
      console.log(
        `API Key: ${config.apiKey ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}` : "not set"}\n`,
      );

      return {
        success: true,
        provider: config.provider,
        model: config.model,
      };
    } catch (error) {
      console.log("❌ Permission denied\n");
      console.log(error instanceof Error ? error.message : "Permission denied");
      console.log("");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Permission denied",
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
