#!/usr/bin/env bun

/**
 * Example: Using context.models to access configured LLM API keys
 *
 * This example demonstrates how to:
 * 1. Access configured model information
 * 2. Get full model config including API keys
 * 3. Use the config to call LLM APIs
 *
 * Prerequisites:
 * - Configure a model: `bun run bin/kly.ts models`
 *
 * Usage:
 * ```bash
 * # Run the tool
 * bun run examples/use-model-config.ts
 *
 * # Trust all apps (for automation)
 * KLY_TRUST_ALL=true bun run examples/use-model-config.ts
 * ```
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { defineApp, tool } from "../src";
import type { ModelConfig } from "../src/types";
import { log, output } from "../src/ui";

const askAiTool = tool({
  name: "ask",
  description: "Ask a question to the configured LLM model",
  inputSchema: z.object({
    question: z.string().describe("The question to ask"),
    modelName: z
      .string()
      .optional()
      .describe("Model configuration name (uses current if not specified)"),
  }),
  execute: async ({ question, modelName }, context) => {
    // 1. List all configured models
    output("📋 Configured models:");
    const models = context.models.list();
    for (const model of models) {
      const marker = model.isCurrent ? "✓" : " ";
      output(
        `  ${marker} ${model.name} - ${model.provider}${model.model ? ` (${model.model})` : ""}`,
      );
    }

    // 2. Get current model info
    const current = context.models.getCurrent();
    if (current) {
      output(`Current model: ${current.name} (${current.provider})`);
    }

    // 3. Get full config including API key
    log.step("Requesting access to API keys...");
    const config = await context.models.getConfigAsync(modelName);

    if (!config) {
      if (modelName) {
        throw new Error(
          `Model '${modelName}' not found. Run 'bun run bin/kly.ts models' to configure.`,
        );
      }
      throw new Error("No LLM model configured. Run 'bun run bin/kly.ts models' to set up.");
    }

    log.success(`Using ${config.provider}`);

    // 4. Create provider based on config
    const provider = createProviderFromConfig(config);

    // 5. Call the LLM
    output(`❓ Question: ${question}`);
    log.step("Thinking...");

    const { text } = await generateText({
      model: provider,
      prompt: question,
    });

    output(`💡 Answer: ${text}`);

    return {
      question,
      answer: text,
      provider: config.provider,
      model: config.model,
    };
  },
});

/**
 * Create AI SDK provider from model config
 */
function createProviderFromConfig(config: ModelConfig) {
  switch (config.provider) {
    case "openai":
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      })(config.model || "gpt-4o-mini");

    case "anthropic":
      return createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      })(config.model || "claude-3-5-haiku-20241022");

    case "google":
      return createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      })(config.model || "gemini-2.0-flash-exp");

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// Define the app
export default defineApp({
  name: "use-model-config",
  version: "0.1.0",
  description: "Example showing how to use context.models to access API keys",
  tools: [askAiTool],
});
