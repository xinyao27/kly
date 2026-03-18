import * as p from "@clack/prompts";

import { initKlyDir, isInitialized } from "../config.js";
import type { KlyConfig } from "../types.js";

export async function runInit(root: string): Promise<void> {
  p.intro("kly init");

  if (isInitialized(root)) {
    p.log.warn(".kly/ directory already exists, reconfiguring...");
  }

  const provider = await p.select({
    message: "Select LLM provider",
    options: [
      { value: "openrouter", label: "OpenRouter", hint: "recommended, supports all models" },
      { value: "anthropic", label: "Anthropic" },
      { value: "openai", label: "OpenAI" },
      { value: "google", label: "Google" },
      { value: "mistral", label: "Mistral" },
      { value: "groq", label: "Groq" },
    ],
  });

  if (p.isCancel(provider)) {
    p.cancel("Init cancelled.");
    process.exit(0);
  }

  const apiKey = await p.password({
    message: `Enter your ${provider} API key`,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "API key is required";
      }
    },
  });

  if (p.isCancel(apiKey)) {
    p.cancel("Init cancelled.");
    process.exit(0);
  }

  const defaultModels: Record<string, string> = {
    openrouter: "anthropic/claude-haiku-4.5",
    anthropic: "claude-haiku-4.5",
    openai: "gpt-4o-mini",
    google: "gemini-2.0-flash",
    mistral: "mistral-small-latest",
    groq: "llama-3.1-8b-instant",
  };

  const model = await p.text({
    message: "Model name",
    initialValue: defaultModels[provider] || "",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Model name is required";
      }
    },
  });

  if (p.isCancel(model)) {
    p.cancel("Init cancelled.");
    process.exit(0);
  }

  const config: KlyConfig = {
    llm: {
      provider,
      model,
      apiKey,
    },
    include: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.swift"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/.kly/**",
      "**/vendor/**",
      "**/*.d.ts",
      "**/*.test.*",
      "**/*.spec.*",
      "**/__tests__/**",
    ],
  };

  initKlyDir(root, config);

  p.log.success("Initialized .kly/ directory");
  p.log.info("Edit .kly/config.yaml to customize settings");
  p.outro("Done!");
}
