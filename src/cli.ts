/* agent-frontmatter:start
AGENT: CLI utilities for Clai
PURPOSE: Parse command line arguments and generate help text
USAGE: Used by defineApp to handle CLI mode execution
EXPORTS: parseCliArgs, parseSubcommand, generateMultiToolsHelp, generateToolHelp, isHelpRequested
FEATURES:
  - Parse --key=value and --key value formats
  - Handle boolean flags (--flag, --no-flag)
  - Auto-convert numbers and booleans
  - Dynamic help generation from JSON Schema
  - Subcommand parsing
SEARCHABLE: cli, args, parser, help, command line, subcommand, json schema
agent-frontmatter:end */

import type { AnyTool, AppDefinition, StandardSchemaV1 } from "./types";

/**
 * Parsed CLI arguments as key-value pairs
 */
export type ParsedArgs = Record<string, string | number | boolean>;

/**
 * JSON Schema property info
 */
interface PropertyInfo {
  name: string;
  type: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  required: boolean;
}

/**
 * Extract JSON Schema from a Standard Schema if available
 */
function extractJsonSchema(
  schema: StandardSchemaV1,
): Record<string, unknown> | null {
  const standard = schema["~standard"] as unknown as Record<string, unknown>;
  if ("jsonSchema" in standard && standard.jsonSchema) {
    const jsonSchema = standard.jsonSchema as {
      output: (opts: { target: string }) => Record<string, unknown>;
    };
    try {
      return jsonSchema.output({ target: "draft-07" });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extract property info from JSON Schema
 */
function extractProperties(
  jsonSchema: Record<string, unknown>,
): PropertyInfo[] {
  const properties = (jsonSchema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = (jsonSchema.required ?? []) as string[];

  return Object.entries(properties).map(([name, prop]) => {
    let type = (prop.type as string) ?? "unknown";

    // Handle enum
    if (prop.enum) {
      type = (prop.enum as unknown[]).join(" | ");
    }

    return {
      name,
      type,
      description: prop.description as string | undefined,
      default: prop.default,
      enum: prop.enum as unknown[] | undefined,
      required: required.includes(name) && prop.default === undefined,
    };
  });
}

/**
 * Format a single option line for help text
 */
function formatOptionLine(prop: PropertyInfo): string {
  const flag = `--${prop.name}`;
  const typeHint = prop.type !== "boolean" ? `=<${prop.type}>` : "";
  const flagPart = `${flag}${typeHint}`.padEnd(25);

  let descPart = prop.description ?? "";

  // Add default value hint
  if (prop.default !== undefined) {
    descPart += ` (default: ${JSON.stringify(prop.default)})`;
  }

  // Add required hint
  if (prop.required) {
    descPart += " [required]";
  }

  return `  ${flagPart} ${descPart}`;
}

/**
 * Generate usage string with required args
 */
function generateUsage(command: string, properties: PropertyInfo[]): string {
  const requiredArgs = properties
    .filter((p) => p.required)
    .map((p) => `--${p.name}=<${p.type}>`)
    .join(" ");

  const optionalHint = properties.some((p) => !p.required) ? " [options]" : "";

  return `  ${command} ${requiredArgs}${optionalHint}`.trim();
}

/**
 * Parse command line arguments into an object
 */
export function parseCliArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i]!;

    // Skip non-flag arguments (positional)
    if (!arg.startsWith("-")) {
      i++;
      continue;
    }

    // Handle --key=value format
    if (arg.includes("=")) {
      const [key, ...valueParts] = arg.split("=");
      const cleanKey = key!.replace(/^-+/, "");
      const value = valueParts.join("=");
      result[cleanKey] = coerceValue(value);
      i++;
      continue;
    }

    // Handle --no-flag format (boolean false)
    if (arg.startsWith("--no-")) {
      const key = arg.slice(5);
      result[key] = false;
      i++;
      continue;
    }

    // Handle --flag or --key value format
    const key = arg.replace(/^-+/, "");
    const nextArg = argv[i + 1];

    // Check if next arg is a value or another flag
    if (nextArg === undefined || nextArg.startsWith("-")) {
      // It's a boolean flag
      result[key] = true;
      i++;
    } else {
      // It's a key-value pair
      result[key] = coerceValue(nextArg);
      i += 2;
    }
  }

  return result;
}

/**
 * Coerce string value to appropriate type
 */
function coerceValue(value: string): string | number | boolean {
  // Boolean
  if (value === "true") return true;
  if (value === "false") return false;

  // Number
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") {
    return num;
  }

  // String
  return value;
}

/**
 * Check if --help or -h was requested
 */
export function isHelpRequested(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

/**
 * Check if --version or -v was requested
 */
export function isVersionRequested(argv: string[]): boolean {
  return argv.includes("--version") || argv.includes("-v");
}

/**
 * Parse subcommand from argv
 */
export function parseSubcommand(argv: string[]): {
  subcommand: string | null;
  args: string[];
} {
  const firstNonFlag = argv.findIndex((arg) => !arg.startsWith("-"));

  if (firstNonFlag === -1) {
    return { subcommand: null, args: argv };
  }

  return {
    subcommand: argv[firstNonFlag]!,
    args: [...argv.slice(0, firstNonFlag), ...argv.slice(firstNonFlag + 1)],
  };
}

/**
 * Generate help text for a single tool (used in multi-tools mode as subcommand help)
 */
export function generateToolHelp(appName: string, tool: AnyTool): string {
  const lines: string[] = [];

  // Header
  lines.push(`${appName} ${tool.name}`);
  lines.push("");
  lines.push(tool.description ?? "No description");
  lines.push("");

  // Try to extract JSON Schema for dynamic help
  const jsonSchema = extractJsonSchema(tool.inputSchema);
  const properties = jsonSchema ? extractProperties(jsonSchema) : [];

  // Usage
  lines.push("Usage:");
  if (properties.length > 0) {
    lines.push(generateUsage(`bun run <file>.ts ${tool.name}`, properties));
  } else {
    lines.push(`  bun run <file>.ts ${tool.name} [options]`);
  }
  lines.push("");

  // Options from schema
  if (properties.length > 0) {
    lines.push("Options:");
    for (const prop of properties) {
      lines.push(formatOptionLine(prop));
    }
    lines.push("");
  }

  // Built-in options
  lines.push("Flags:");
  lines.push("  --help, -h               Show this help message");

  return lines.join("\n");
}

/**
 * Generate help text for single tool app (no subcommand needed)
 */
export function generateSingleToolHelp(
  config: AppDefinition,
  tool: AnyTool,
): string {
  const lines: string[] = [];

  // Header
  lines.push(`${config.name} v${config.version}`);
  lines.push("");
  lines.push(config.description);
  lines.push("");

  // Try to extract JSON Schema for dynamic help
  const jsonSchema = extractJsonSchema(tool.inputSchema);
  const properties = jsonSchema ? extractProperties(jsonSchema) : [];

  // Usage
  lines.push("Usage:");
  if (properties.length > 0) {
    lines.push(generateUsage("bun run <file>.ts", properties));
  } else {
    lines.push("  bun run <file>.ts [options]");
  }
  lines.push("");

  // Options from schema
  if (properties.length > 0) {
    lines.push("Options:");
    for (const prop of properties) {
      lines.push(formatOptionLine(prop));
    }
    lines.push("");
  }

  // Built-in options
  lines.push("Flags:");
  lines.push("  --help, -h               Show this help message");
  lines.push("  --version, -v            Show version");

  return lines.join("\n");
}

/**
 * Generate help text from app config
 */
export function generateMultiToolsHelp(config: AppDefinition): string {
  const lines: string[] = [];

  // Header
  lines.push(`${config.name} v${config.version}`);
  lines.push("");
  lines.push(config.description);
  lines.push("");

  // Usage
  lines.push("Usage:");
  lines.push("  bun run <file>.ts <command> [options]");
  lines.push("");

  // Commands
  lines.push("Commands:");
  for (const tool of config.tools) {
    const desc = tool.description ?? "";
    lines.push(`  ${tool.name.padEnd(15)} ${desc}`);
  }
  lines.push("");

  // Flags
  lines.push("Flags:");
  lines.push("  --help, -h               Show this help message");
  lines.push("  --version, -v            Show version");
  lines.push("");
  lines.push(`Run '${config.name} <command> --help' for more information.`);

  return lines.join("\n");
}
