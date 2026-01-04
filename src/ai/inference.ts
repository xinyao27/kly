import { generateText } from "ai";
import type { StandardSchemaV1 } from "../types";
import { isTTY, spinner } from "../ui";
import { getNoLLMConfiguredMessage } from "./config";
import { createModel } from "./provider";
import { getCurrentModelConfig } from "./storage";

/**
 * Simple in-memory cache for parameter extraction results
 * Key: hash of (naturalInput + schema + providedArgs)
 * Value: extracted parameters
 */
const _parameterCache = new Map<string, Record<string, unknown>>();
const _MAX_CACHE_SIZE = 100;

/**
 * Generate a simple cache key from inputs
 */
function _getCacheKey(
  naturalInput: string,
  schema: StandardSchemaV1,
  providedArgs: Record<string, unknown>,
): string {
  // Simple hash: combine inputs with JSON.stringify
  const schemaKey = JSON.stringify(extractJsonSchema(schema));
  const argsKey = JSON.stringify(providedArgs);
  return `${naturalInput}|${schemaKey}|${argsKey}`;
}

/**
 * Extract JSON Schema from StandardSchemaV1
 */
function extractJsonSchema(schema: StandardSchemaV1): unknown {
  const standard = schema["~standard"];
  if (!standard || !("jsonSchema" in standard)) {
    throw new Error("Schema must support JSON Schema (missing ~standard.jsonSchema)");
  }
  return standard.jsonSchema;
}

/**
 * Build system prompt with schema information
 */
function buildSystemPrompt(jsonSchema: any, providedArgs: Record<string, unknown>): string {
  const providedInfo =
    Object.keys(providedArgs).length > 0
      ? `\n\nThe following parameters are already provided:\n${JSON.stringify(providedArgs, null, 2)}\nDo NOT extract these again.`
      : "";

  // Extract required fields from schema
  const required = jsonSchema.required || [];
  const requiredInfo =
    required.length > 0 ? `\n\nREQUIRED fields (must be present): ${required.join(", ")}` : "";

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
  // Check cache first
  const cacheKey = _getCacheKey(naturalInput, schema, providedArgs);
  const cached = _parameterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const config = getCurrentModelConfig();
  if (!config) {
    throw new Error(getNoLLMConfiguredMessage());
  }

  const model = createModel(config);
  const modelName = config.model || "";

  // Extract JSON schema and build system prompt
  const jsonSchema = extractJsonSchema(schema);
  const systemPrompt = buildSystemPrompt(jsonSchema, providedArgs);

  // Show spinner while calling LLM (only in TTY mode)
  const s = isTTY() ? spinner("Analyzing your request with AI...") : null;

  try {
    // Note: Reasoning models (like o1, o3) don't support temperature parameter
    // For those models, omit temperature to avoid warnings
    const isReasoningModel =
      modelName.includes("o1") || modelName.includes("o3") || modelName.includes("gpt-5");

    const { text } = await generateText({
      model,
      ...(isReasoningModel ? {} : { temperature: 0 }),
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
    } catch {
      s?.fail("Failed to parse LLM response");
      throw new Error(`Failed to parse LLM response as JSON. Response was:\n${text}`);
    }

    const result = { ...parsed, ...providedArgs };

    // Cache the result (with size limit)
    if (_parameterCache.size >= _MAX_CACHE_SIZE) {
      // Remove oldest entry (first item in Map)
      const firstKey = _parameterCache.keys().next().value;
      if (firstKey) {
        _parameterCache.delete(firstKey);
      }
    }
    _parameterCache.set(cacheKey, result);

    return result;
  } catch (error) {
    s?.fail("Failed to analyze request");
    throw error;
  }
}

/**
 * Select the most appropriate tool based on user input using LLM
 */
export async function selectTool(
  userInput: string,
  tools: Array<{ name: string; description: string }>,
): Promise<string> {
  if (tools.length === 0) {
    throw new Error("No tools available");
  }

  if (tools.length === 1) {
    return tools[0]!.name;
  }

  const config = getCurrentModelConfig();
  if (!config) {
    throw new Error(getNoLLMConfiguredMessage());
  }

  const model = createModel(config);
  const modelName = config.model || "";

  // Build system prompt for tool selection
  const toolsDescription = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

  const systemPrompt = `You are a tool selection assistant. Given user input and available tools, select the most appropriate tool.

Available tools:
${toolsDescription}

Instructions:
1. Output ONLY the tool name (e.g., "current" or "forecast")
2. No explanation, no markdown, just the exact tool name
3. Choose based on the user's intent`;

  const s = isTTY() ? spinner("Selecting tool...") : null;

  try {
    // Note: Reasoning models (like o1, o3) don't support temperature parameter
    const isReasoningModel =
      modelName.includes("o1") || modelName.includes("o3") || modelName.includes("gpt-5");

    const { text } = await generateText({
      model,
      ...(isReasoningModel ? {} : { temperature: 0 }),
      system: systemPrompt,
      prompt: userInput,
    });

    s?.succeed("Tool selected");

    const selectedTool = text.trim();

    // Validate the selection
    const tool = tools.find((t) => t.name === selectedTool);
    if (!tool) {
      throw new Error(
        `LLM selected unknown tool '${selectedTool}'. Available: ${tools.map((t) => t.name).join(", ")}`,
      );
    }

    return selectedTool;
  } catch (error) {
    s?.fail("Failed to select tool");
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
