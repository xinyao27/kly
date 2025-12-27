import * as clack from "@clack/prompts";
import pc from "picocolors";
import {
  fetchModelsDevData,
  formatCapabilities,
  formatPrice,
  getModelInfo,
  getProviderModels,
  type ModelInfo,
} from "./models-dev";
import { getDefaultBaseURL, getProviderDescription } from "./provider-config";
import {
  getProviderDisplayName,
  listModels,
  removeModelConfig,
  saveModelConfig,
  setCurrentModel,
} from "./storage";
import type { LLMProvider } from "./types";
import { DEFAULT_MODELS } from "./types";

const PROVIDER_OPTIONS: Array<{
  value: LLMProvider;
  label: string;
  hint?: string;
}> = [
  {
    value: "openai",
    label: "OpenAI",
    hint: getProviderDescription("openai"),
  },
  {
    value: "anthropic",
    label: "Anthropic",
    hint: getProviderDescription("anthropic"),
  },
  {
    value: "google",
    label: "Google",
    hint: getProviderDescription("google"),
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    hint: getProviderDescription("deepseek"),
  },
  { value: "groq", label: "Groq", hint: getProviderDescription("groq") },
  {
    value: "mistral",
    label: "Mistral",
    hint: getProviderDescription("mistral"),
  },
  {
    value: "cohere",
    label: "Cohere",
    hint: getProviderDescription("cohere"),
  },
  {
    value: "ollama",
    label: "Ollama",
    hint: getProviderDescription("ollama"),
  },
  {
    value: "openai-compatible",
    label: "OpenAI Compatible",
    hint: "Custom endpoint",
  },
];

/**
 * Main entry point for `clai models` command
 */
export async function modelsCommand(): Promise<void> {
  clack.intro(pc.bgCyan(pc.black(" clai models ")));

  const models = listModels();

  const action = (await clack.select({
    message: "What would you like to do?",
    options: [
      { value: "list", label: "List configured models" },
      { value: "add", label: "Add a new model" },
      {
        value: "switch",
        label: "Switch current model",
        disabled: models.length === 0,
      },
      {
        value: "remove",
        label: "Remove a model",
        disabled: models.length === 0,
      },
    ],
  })) as string;

  if (clack.isCancel(action)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  switch (action) {
    case "list":
      await listAction();
      break;
    case "add":
      await addAction();
      break;
    case "switch":
      await switchAction();
      break;
    case "remove":
      await removeAction();
      break;
  }

  clack.outro(pc.green("Done!"));
}

/**
 * List all configured models
 */
async function listAction(): Promise<void> {
  const models = listModels();

  if (models.length === 0) {
    clack.note(
      "No models configured yet.\nRun 'clai models' and select 'Add a new model'",
    );
    return;
  }

  // Try to fetch models.dev data for enhanced info
  const modelsData = await fetchModelsDevData();

  const lines: string[] = [];
  for (const model of models) {
    const current = model.isCurrent ? pc.green("✓ ") : "  ";
    const provider = getProviderDisplayName(model.config.provider);
    const modelName =
      model.config.model || DEFAULT_MODELS[model.config.provider];

    let line = `${current}${pc.cyan(model.name)} - ${provider} (${modelName})`;

    // Add pricing and capabilities if available
    if (modelsData) {
      const modelInfo = getModelInfo(
        modelsData,
        model.config.provider,
        modelName,
      );

      if (modelInfo) {
        const metadata = formatModelMetadata(modelInfo);
        if (metadata) {
          line += ` ${pc.dim(metadata)}`;
        }
      }
    }

    lines.push(line);
  }

  clack.note(lines.join("\n"), "Configured models:");
}

/**
 * Format model metadata (pricing and capabilities) for display
 */
function formatModelMetadata(modelInfo: ModelInfo): string {
  const parts: string[] = [];

  // Add pricing
  if (
    modelInfo.cost?.input !== undefined &&
    modelInfo.cost?.output !== undefined
  ) {
    parts.push(
      `[$${formatPrice(modelInfo.cost.input)}/$${formatPrice(modelInfo.cost.output)} per 1M]`,
    );
  }

  // Add capabilities
  const caps = formatCapabilities(modelInfo);
  if (caps.length > 0) {
    parts.push(`[${caps.join(", ")}]`);
  }

  return parts.join(" ");
}

/**
 * Add a new model configuration
 */
async function addAction(): Promise<void> {
  const name = await clack.text({
    message: "Enter a name for this model configuration:",
    placeholder: "my-openai",
    validate: (value) => {
      if (!value) return "Name is required";
      if (listModels().some((m) => m.name === value)) {
        return "A model with this name already exists";
      }
      return undefined;
    },
  });

  if (clack.isCancel(name)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  const provider = (await clack.select({
    message: "Select a provider:",
    options: PROVIDER_OPTIONS,
  })) as LLMProvider;

  if (clack.isCancel(provider)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  // Get provider-specific configuration
  const config = await getProviderConfig(provider);

  saveModelConfig(name, config);

  clack.note(
    `Model '${pc.cyan(name)}' configured with ${getProviderDisplayName(provider)}`,
    pc.green("Success!"),
  );
}

/**
 * Switch to a different model
 */
async function switchAction(): Promise<void> {
  const models = listModels();

  if (models.length === 0) {
    clack.note("No models configured");
    return;
  }

  const modelName = (await clack.select({
    message: "Select a model:",
    options: models.map((m) => ({
      value: m.name,
      label: m.name,
      hint: `${getProviderDisplayName(m.config.provider)} - ${m.config.model || DEFAULT_MODELS[m.config.provider]}`,
    })),
  })) as string;

  if (clack.isCancel(modelName)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  setCurrentModel(modelName);

  clack.note(`Switched to '${pc.cyan(modelName)}'`, pc.green("Success!"));
}

/**
 * Remove a model configuration
 */
async function removeAction(): Promise<void> {
  const models = listModels();

  if (models.length === 0) {
    clack.note("No models configured");
    return;
  }

  const modelName = (await clack.select({
    message: "Select a model to remove:",
    options: models.map((m) => ({
      value: m.name,
      label: m.name,
      hint: `${getProviderDisplayName(m.config.provider)}`,
    })),
  })) as string;

  if (clack.isCancel(modelName)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  const confirm = (await clack.confirm({
    message: `Are you sure you want to remove '${modelName}'?`,
  })) as boolean;

  if (clack.isCancel(confirm) || !confirm) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  removeModelConfig(modelName);

  clack.note(`Removed '${pc.cyan(modelName)}'`, pc.green("Success!"));
}

/**
 * Get provider-specific configuration
 */
async function getProviderConfig(provider: LLMProvider): Promise<{
  provider: LLMProvider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
}> {
  const defaultModel = DEFAULT_MODELS[provider];

  // Ollama doesn't need API key
  if (provider === "ollama") {
    const baseURL = (await clack.text({
      message: "Ollama base URL:",
      placeholder: "http://localhost:11434",
      defaultValue: "http://localhost:11434",
    })) as string;

    if (clack.isCancel(baseURL)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    const model = (await clack.text({
      message: "Model name:",
      placeholder: defaultModel,
      defaultValue: defaultModel,
    })) as string;

    if (clack.isCancel(model)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    return {
      provider,
      baseURL: baseURL || "http://localhost:11434",
      model: model || defaultModel,
    };
  }

  // Other providers need API key
  const apiKey = (await clack.password({
    message: `Enter your ${getProviderDisplayName(provider)} API key:`,
    validate: (value) => {
      if (!value) return "API key is required";
      return undefined;
    },
  })) as string;

  if (clack.isCancel(apiKey)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  // Ask for optional base URL
  const customBaseURL = (await clack.confirm({
    message: "Do you want to specify a custom base URL?",
    initialValue: false,
  })) as boolean;

  if (clack.isCancel(customBaseURL)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  let baseURL: string | undefined;

  if (customBaseURL) {
    const defaultURL = getDefaultBaseURL(provider);
    const baseURLInput = (await clack.text({
      message: "Base URL:",
      placeholder: defaultURL || "",
    })) as string;

    if (clack.isCancel(baseURLInput)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    baseURL = baseURLInput || undefined;
  }

  // Try to fetch models from models.dev and let user select
  const model = await selectModelForProvider(provider, defaultModel);

  return {
    provider,
    apiKey,
    baseURL,
    model,
  };
}

/**
 * Let user select a model for a provider
 */
async function selectModelForProvider(
  provider: LLMProvider,
  defaultModel: string,
): Promise<string | undefined> {
  const modelsData = await fetchModelsDevData();

  // If we have models.dev data and models are available, show selection
  if (modelsData) {
    const availableModels = getProviderModels(modelsData, provider);

    if (availableModels.length > 0) {
      return await selectFromModelList(availableModels, defaultModel);
    }
  }

  // Fallback to simple confirm/input
  return await selectModelWithInput(defaultModel);
}

/**
 * Show model selection list with pricing and capabilities
 */
async function selectFromModelList(
  availableModels: ModelInfo[],
  defaultModel: string,
): Promise<string | undefined> {
  const modelOptions = availableModels.slice(0, 10).map((m) => {
    const parts: string[] = [];

    // Add pricing if available
    if (m.cost?.input !== undefined && m.cost?.output !== undefined) {
      parts.push(
        `$${formatPrice(m.cost.input)}/$${formatPrice(m.cost.output)} per 1M`,
      );
    }

    // Add capabilities
    const caps = formatCapabilities(m);
    if (caps.length > 0) {
      parts.push(caps.join(", "));
    }

    return {
      value: m.id,
      label: m.name || m.id,
      hint: parts.length > 0 ? parts.join(" • ") : "No info available",
    };
  });

  // Add option to use default or enter custom
  modelOptions.push({
    value: "__default__",
    label: `Use default (${defaultModel})`,
    hint: "Recommended",
  });
  modelOptions.push({
    value: "__custom__",
    label: "Enter custom model name",
    hint: "Advanced",
  });

  const selectedModel = (await clack.select({
    message: "Select a model:",
    options: modelOptions,
  })) as string;

  if (clack.isCancel(selectedModel)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  if (selectedModel === "__default__") {
    return undefined; // Use default
  }

  if (selectedModel === "__custom__") {
    return await promptForModelName(defaultModel);
  }

  return selectedModel;
}

/**
 * Simple model selection via confirm + input
 */
async function selectModelWithInput(
  defaultModel: string,
): Promise<string | undefined> {
  const useDefault = (await clack.confirm({
    message: `Use default model (${defaultModel})?`,
    initialValue: true,
  })) as boolean;

  if (clack.isCancel(useDefault)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  if (useDefault) {
    return undefined;
  }

  return await promptForModelName(defaultModel);
}

/**
 * Prompt user to enter a custom model name
 */
async function promptForModelName(defaultModel: string): Promise<string> {
  const modelInput = (await clack.text({
    message: "Model name:",
    placeholder: defaultModel,
    defaultValue: defaultModel,
  })) as string;

  if (clack.isCancel(modelInput)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  return modelInput || defaultModel;
}
