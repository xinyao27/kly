import * as p from "@clack/prompts";
import pc from "picocolors";
import { isTTY } from "../utils/tty";

/**
 * Field definition for forms
 */
export interface FormField {
  /** Field name/key */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: "string" | "number" | "boolean" | "enum";
  /** Whether field is required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Description/help text */
  description?: string;
  /** Enum options (for type: "enum") */
  enumValues?: string[];
}

/**
 * Configuration for form component
 */
export interface FormConfig {
  /** Form fields */
  fields: FormField[];
  /** Form title */
  title?: string;
}

/**
 * Prompt for multiple fields sequentially
 *
 * @example
 * ```typescript
 * const values = await form({
 *   title: "User Registration",
 *   fields: [
 *     { name: "name", label: "Your name", type: "string", required: true },
 *     { name: "age", label: "Your age", type: "number", defaultValue: 18 },
 *     { name: "role", label: "Role", type: "enum", enumValues: ["admin", "user"] },
 *     { name: "subscribe", label: "Subscribe to newsletter?", type: "boolean" }
 *   ]
 * });
 * // values: { name: string, age: number, role: string, subscribe: boolean }
 * ```
 */
export async function form(
  config: FormConfig,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  if (config.title) {
    console.log(`\n${pc.bold(config.title)}\n`);
  }

  // Non-TTY fallback: return defaults
  if (!isTTY()) {
    for (const field of config.fields) {
      result[field.name] = field.defaultValue;
    }
    return result;
  }

  for (const field of config.fields) {
    const label = field.description
      ? `${field.label} (${field.description})`
      : field.label;

    if (field.type === "boolean") {
      const value = await p.confirm({
        message: label,
        initialValue: field.defaultValue as boolean | undefined,
      });

      if (p.isCancel(value)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }

      result[field.name] = value;
    } else if (field.type === "enum" && field.enumValues?.length) {
      const value = await p.select({
        message: label,
        options: field.enumValues.map((v) => ({
          label: v,
          value: v,
        })),
      });

      if (p.isCancel(value)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }

      result[field.name] = value;
    } else if (field.type === "number") {
      const strValue = await p.text({
        message: label,
        defaultValue: field.defaultValue?.toString(),
        validate: (value) => {
          if (value && Number.isNaN(Number.parseFloat(value))) {
            return "Please enter a valid number";
          }
          return undefined;
        },
      });

      if (p.isCancel(strValue)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }

      result[field.name] = Number.parseFloat(strValue);
    } else {
      const value = await p.text({
        message: label,
        defaultValue: field.defaultValue as string | undefined,
      });

      if (p.isCancel(value)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }

      result[field.name] = value;
    }
  }

  return result;
}
