import * as z from "zod";
import type { StandardSchemaV1 } from "../types";

/**
 * JSON Schema for MCP tool inputs
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Convert StandardSchema to JSON Schema for MCP
 *
 * Currently supports Zod schemas (v4+).
 * For other schema libraries (Valibot, ArkType, etc.), add conversion logic here.
 */
export function convertToJsonSchema(schema: StandardSchemaV1): JsonSchema {
  // Check if it's a Zod schema by looking for _def property
  const zodSchema = schema as any;

  if (zodSchema._def) {
    // It's a Zod 4+ schema - use z.toJSONSchema() function
    const jsonSchema = z.toJSONSchema(zodSchema as z.ZodType, {
      target: "draft-07",
      unrepresentable: "any",
      io: "output",
    });

    // Remove $schema property if present (MCP doesn't need it)
    const { $schema, ...rest } = jsonSchema as Record<string, unknown>;

    return rest as JsonSchema;
  }

  // For other StandardSchema implementations, try to extract schema info
  // This is a fallback that creates a basic JSON schema
  console.warn(
    "Unknown schema type - using fallback conversion. Consider adding explicit support for your schema library.",
  );

  return {
    type: "object",
    properties: {},
    required: [],
  };
}
