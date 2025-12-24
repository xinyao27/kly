/* agent-frontmatter:start
AGENT: Tool helper function
PURPOSE: Create type-safe tool definitions with parameter inference
USAGE: import { tool } from "clai"
EXPORTS: tool
FEATURES:
  - TypeScript type inference from parameters to execute args
  - Vercel AI SDK compatible API
  - Composable with defineApp
SEARCHABLE: tool, helper, type inference, ai sdk
agent-frontmatter:end */

import type { StandardSchemaV1, Tool, ToolDefinition } from "./types";

/**
 * Tool definition input with required name
 */
interface ToolInput<TInput extends StandardSchemaV1, TResult = unknown>
  extends ToolDefinition<TInput, TResult> {
  /** Tool name (used as subcommand in CLI, tool name in MCP) */
  name: string;
}

/**
 * Create a type-safe tool definition
 *
 * This is a helper function that enables TypeScript to infer the types
 * of execute arguments from the inputSchema. Without this helper,
 * TypeScript cannot establish the connection between schema and execute.
 *
 * @example
 * ```typescript
 * import { tool } from "clai"
 * import { z } from "zod"
 *
 * const weatherTool = tool({
 *   name: "weather",
 *   description: "Get weather for a location",
 *   inputSchema: z.object({
 *     city: z.string().describe("City name"),
 *     unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
 *   }),
 *   execute: async ({ city, unit }) => {
 *     // city is inferred as string
 *     // unit is inferred as "celsius" | "fahrenheit"
 *     return fetchWeather(city, unit)
 *   },
 * })
 * ```
 */
export function tool<TInput extends StandardSchemaV1, TResult = unknown>(
  definition: ToolInput<TInput, TResult>,
): Tool<TInput, TResult> {
  return {
    ...definition,
    _brand: "Tool" as const,
  };
}
