import { ExitWarning } from "../shared/errors";
import {
  colors,
  confirm,
  intro,
  note,
  outro,
  password,
  type SelectOption,
  select,
  text,
} from "../ui";
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

const PROVIDER_OPTIONS: SelectOption<LLMProvider>[] = [
  {
    value: "openai",
    name: "OpenAI",
    description: getProviderDescription("openai"),
  },
  {
    value: "anthropic",
    name: "Anthropic",
    description: getProviderDescription("anthropic"),
  },
  {
    value: "google",
    name: "Google",
    description: getProviderDescription("google"),
  },
  {
    value: "deepseek",
    name: "DeepSeek",
    description: getProviderDescription("deepseek"),
  },
  { value: "groq", name: "Groq", description: getProviderDescription("groq") },
  {
    value: "mistral",
    name: "Mistral",
    description: getProviderDescription("mistral"),
  },
  {
    value: "cohere",
    name: "Cohere",
    description: getProviderDescription("cohere"),
  },
  {
    value: "ollama",
    name: "Ollama",
    description: getProviderDescription("ollama"),
  },
  {
    value: "openai-compatible",
    name: "OpenAI Compatible",
    description: "Custom endpoint",
  },
];

/**
 * Main entry point for `kly models` command
 */
export async function modelsCommand(): Promise<void> {
  intro(colors.bgCyan(colors.black(" kly models ")));

  const models = listModels();

  const action = await select<string>({
    prompt: "What would you like to do?",
    options: [
      { value: "list", name: "List configured models" },
      { value: "add", name: "Add a new model" },
      {
        value: "switch",
        name: "Switch current model",
        disabled: models.length === 0,
      },
      {
        value: "remove",
        name: "Remove a model",
        disabled: models.length === 0,
      },
    ],
  });

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

  outro(colors.green("Done!"));
}

/**
 * List all configured models
 */
async function listAction(): Promise<void> {
  const models = listModels();

  if (models.length === 0) {
    note(
      "No models configured yet.\nRun 'kly models' and select 'Add a new model'",
    );
    return;
  }

  // Try to fetch models.dev data for enhanced info
  const modelsData = await fetchModelsDevData();

  const lines: string[] = [];
  for (const model of models) {
    const current = model.isCurrent ? colors.green("✓ ") : "  ";
    const provider = getProviderDisplayName(model.config.provider);
    const modelName =
      model.config.model || DEFAULT_MODELS[model.config.provider];

    let line = `${current}${colors.cyan(model.name)} - ${provider} (${modelName})`;

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
          line += ` ${colors.dim(metadata)}`;
        }
      }
    }

    lines.push(line);
  }

  note(lines.join("\n"), "Configured models:");
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
  const name = await text({
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

  const provider = await select<LLMProvider>({
    prompt: "Select a provider:",
    options: PROVIDER_OPTIONS,
  });

  // Get provider-specific configuration
  const config = await getProviderConfig(provider);

  saveModelConfig(name, config);

  note(
    `Model '${colors.cyan(name)}' configured with ${getProviderDisplayName(provider)}`,
    colors.green("Success!"),
  );
}

/**
 * Switch to a different model
 */
async function switchAction(): Promise<void> {
  const models = listModels();

  if (models.length === 0) {
    note("No models configured");
    return;
  }

  const modelName = await select<string>({
    prompt: "Select a model:",
    options: models.map((m) => ({
      value: m.name,
      name: m.name,
      description: `${getProviderDisplayName(m.config.provider)} - ${m.config.model || DEFAULT_MODELS[m.config.provider]}`,
    })),
  });

  setCurrentModel(modelName);

  note(`Switched to '${colors.cyan(modelName)}'`, colors.green("Success!"));
}

/**
 * Remove a model configuration
 */
async function removeAction(): Promise<void> {
  const models = listModels();

  if (models.length === 0) {
    note("No models configured");
    return;
  }

  const modelName = await select<string>({
    prompt: "Select a model to remove:",
    options: models.map((m) => ({
      value: m.name,
      name: m.name,
      description: `${getProviderDisplayName(m.config.provider)}`,
    })),
  });

  const confirmed = await confirm(
    `Are you sure you want to remove '${modelName}'?`,
  );

  if (!confirmed) {
    throw new ExitWarning();
  }

  removeModelConfig(modelName);

  note(`Removed '${colors.cyan(modelName)}'`, colors.green("Success!"));
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
    const baseURL = await text({
      message: "Ollama base URL:",
      placeholder: "http://localhost:11434",
      defaultValue: "http://localhost:11434",
    });

    const model = await text({
      message: "Model name:",
      placeholder: defaultModel,
      defaultValue: defaultModel,
    });

    return {
      provider,
      baseURL: baseURL || "http://localhost:11434",
      model: model || defaultModel,
    };
  }

  // Other providers need API key
  const apiKey = await password({
    prompt: `Enter your ${getProviderDisplayName(provider)} API key:`,
    validate: (value) => {
      if (!value) return "API key is required";
      return undefined;
    },
  });

  // Ask for optional base URL
  const customBaseURL = await confirm(
    "Do you want to specify a custom base URL?",
    false,
  );

  let baseURL: string | undefined;

  if (customBaseURL) {
    const defaultURL = getDefaultBaseURL(provider);
    const baseURLInput = await text({
      message: "Base URL:",
      placeholder: defaultURL || "",
    });

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
  const modelOptions: SelectOption<string>[] = availableModels
    .slice(0, 10)
    .map((m) => {
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
        name: m.name || m.id,
        description: parts.length > 0 ? parts.join(" - ") : "No info available",
      };
    });

  // Add option to use default or enter custom
  modelOptions.push({
    value: "__default__",
    name: `Use default (${defaultModel})`,
    description: "Recommended",
  });
  modelOptions.push({
    value: "__custom__",
    name: "Enter custom model name",
    description: "Advanced",
  });

  const selectedModel = await select<string>({
    prompt: "Select a model:",
    options: modelOptions,
  });

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
  const useDefault = await confirm(
    `Use default model (${defaultModel})?`,
    true,
  );

  if (useDefault) {
    return undefined;
  }

  return await promptForModelName(defaultModel);
}

/**
 * Prompt user to enter a custom model name
 */
async function promptForModelName(defaultModel: string): Promise<string> {
  const modelInput = await text({
    message: "Model name:",
    placeholder: defaultModel,
    defaultValue: defaultModel,
  });

  return modelInput || defaultModel;
}
