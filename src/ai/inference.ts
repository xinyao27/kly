import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { StandardSchemaV1 } from "../types";
import { isTTY, spinner } from "../ui";
import { detectLLMConfig, getNoLLMConfiguredMessage } from "./config";

/**
 * Extract JSON Schema from StandardSchemaV1
 */
function extractJsonSchema(schema: StandardSchemaV1): unknown {
  const standard = schema["~standard"];
  if (!standard || !("jsonSchema" in standard)) {
    throw new Error(
      "Schema must support JSON Schema (missing ~standard.jsonSchema)",
    );
  }
  return standard.jsonSchema;
}

/**
 * Build system prompt with schema information
 */
function buildSystemPrompt(
  jsonSchema: any,
  providedArgs: Record<string, unknown>,
): string {
  const providedInfo =
    Object.keys(providedArgs).length > 0
      ? `\n\nThe following parameters are already provided:\n${JSON.stringify(providedArgs, null, 2)}\nDo NOT extract these again.`
      : "";

  // Extract required fields from schema
  const required = jsonSchema.required || [];
  const requiredInfo =
    required.length > 0
      ? `\n\nREQUIRED fields (must be present): ${required.join(", ")}`
      : "";

  return `You are a parameter extraction assistant. Extract structured parameters from natural language input.

Schema:
${JSON.stringify(jsonSchema, null, 2)}${requiredInfo}${providedInfo}

Instructions:
1. Output ONLY a JSON object, no markdown code blocks, no explanation
2. Extract ALL required fields from the user's input
3. Use correct types: numbers as numbers (not strings), strings as strings
4. For optional fields, include them if mentioned in the input
5. Common patterns:
   - "week" or "7 days" → days: 7
   - "month" → days: 30
   - "$2000" or "2000 dollars" → budget: 2000
   - "Beijing", "Paris", "Tokyo" → city: "Beijing"/"Paris"/"Tokyo"
6. If field has a default and user doesn't specify it, you can omit it`;
}

/**
 * Parse natural language input into structured parameters using LLM
 */
export async function parseNaturalLanguage(
  naturalInput: string,
  schema: StandardSchemaV1,
  providedArgs: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const config = detectLLMConfig();
  if (!config) {
    throw new Error(getNoLLMConfiguredMessage());
  }

  const modelName =
    config.model ||
    (config.provider === "openai" ? "gpt-5-mini" : "claude-4-5-haiku");

  const provider =
    config.provider === "openai"
      ? createOpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseURL,
        })
      : createAnthropic({
          apiKey: config.apiKey,
          baseURL: config.baseURL,
        });

  const model = provider(modelName);

  // Extract JSON schema and build system prompt
  const jsonSchema = extractJsonSchema(schema);
  const systemPrompt = buildSystemPrompt(jsonSchema, providedArgs);

  // Show spinner while calling LLM (only in TTY mode)
  const s = isTTY() ? spinner("Analyzing your request with AI...") : null;

  try {
    const { text } = await generateText({
      model,
      temperature: 0,
      system: systemPrompt,
      prompt: naturalInput,
    });

    s?.succeed("Parameters extracted");

    // Parse JSON response and merge with provided args
    let parsed: Record<string, unknown>;
    try {
      // Remove markdown code blocks if present
      const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (_parseError) {
      s?.fail("Failed to parse LLM response");
      throw new Error(
        `Failed to parse LLM response as JSON. Response was:\n${text}`,
      );
    }

    return { ...parsed, ...providedArgs };
  } catch (error) {
    s?.fail("Failed to analyze request");
    throw error;
  }
}

export function isNaturalLanguage(input: string): boolean {
  if (!input) return false;
  if (input.startsWith("--") || input.startsWith("-")) return false;

  const hasSpaces = input.includes(" ");
  const hasQuestionMark = input.includes("?");
  const hasCommonWords =
    /\b(is|are|can|could|should|would|will|what|when|where|why|how|the|a|an|in|on|at|to|for)\b/i.test(
      input,
    );

  return hasSpaces || hasQuestionMark || hasCommonWords;
}
