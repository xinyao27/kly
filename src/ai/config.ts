export function getNoLLMConfiguredMessage(): string {
  return `Natural language mode requires a configured LLM model.

Run the following command to configure a model:

  kly models

This will guide you through selecting a provider and configuring your API key.`;
}
