import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";

import { initKlyDir, isInitialized } from "../config";
import type { KlyConfig } from "../types";
import { runHook } from "./hook";
import { info } from "./output";

export interface InitOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  hook?: boolean;
  include?: string[];
  exclude?: string[];
}

const VALID_PROVIDERS = ["openrouter", "anthropic", "openai", "google", "mistral", "groq"];

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: "anthropic/claude-haiku-4.5",
  anthropic: "claude-haiku-4.5",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  mistral: "mistral-small-latest",
  groq: "llama-3.1-8b-instant",
};

const DEFAULT_INCLUDE = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.swift"];
const DEFAULT_EXCLUDE = [
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
];

export async function runInit(root: string, options: InitOptions = {}): Promise<void> {
  // If provider and api-key are provided, run non-interactively
  if (options.provider && options.apiKey) {
    runNonInteractive(root, options);
    return;
  }

  // Fallback to interactive mode
  await runInteractive(root, options);
}

function runNonInteractive(root: string, options: InitOptions): void {
  if (!VALID_PROVIDERS.includes(options.provider!)) {
    process.stderr.write(
      `Error: Invalid provider "${options.provider}".\n  Valid providers: ${VALID_PROVIDERS.join(", ")}\n  kly init --provider openrouter --api-key <key>\n`,
    );
    process.exit(1);
  }

  const config: KlyConfig = {
    llm: {
      provider: options.provider!,
      model: options.model || DEFAULT_MODELS[options.provider!] || "",
      apiKey: options.apiKey!,
    },
    include: options.include?.length ? options.include : DEFAULT_INCLUDE,
    exclude: options.exclude?.length ? options.exclude : DEFAULT_EXCLUDE,
  };

  initKlyDir(root, config);
  info("initialized .kly/ directory");

  if (options.hook) {
    const isGit = fs.existsSync(path.join(root, ".git"));
    if (isGit) {
      runHook(root, "install");
      info("installed post-commit hook");
    } else {
      process.stderr.write("Warning: Not a git repo, skipping hook install.\n");
    }
  }
}

async function runInteractive(root: string, _options: InitOptions): Promise<void> {
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

  const model = await p.text({
    message: "Model name",
    initialValue: DEFAULT_MODELS[provider] || "",
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
    include: DEFAULT_INCLUDE,
    exclude: DEFAULT_EXCLUDE,
  };

  initKlyDir(root, config);

  p.log.success("Initialized .kly/ directory");
  p.log.info("Edit .kly/config.yaml to customize settings");

  // Offer to install git hook if in a git repo
  const isGit = fs.existsSync(path.join(root, ".git"));
  if (isGit) {
    const installHook = await p.confirm({
      message: "Install post-commit hook for automatic indexing?",
      initialValue: true,
    });

    if (!p.isCancel(installHook) && installHook) {
      runHook(root, "install");
    }
  }

  p.outro("Done!");
}
