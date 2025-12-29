import * as p from "@clack/prompts";
import { sendIPCRequest } from "../../sandbox/ipc-client";
import { isMCP, isSandbox } from "../../shared/runtime-mode";
import { handleCancel } from "../utils/cancel";
import { colors } from "../utils/colors";
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
  // Sandbox mode: use IPC to request form from host
  if (isSandbox()) {
    return sendIPCRequest<Record<string, unknown>>("prompt:form", config);
  }

  const result: Record<string, unknown> = {};

  // Non-TTY fallback: return defaults or throw in MCP mode
  if (!isTTY()) {
    if (config.title) {
      console.log(colors.bold(config.title));
    }
    // In MCP mode, interactive forms are not allowed
    if (isMCP()) {
      const requiredFields = config.fields
        .filter((f) => f.required && f.defaultValue === undefined)
        .map((f) => f.name);

      if (requiredFields.length > 0) {
        throw new Error(
          `Interactive form not available in MCP mode. All parameters must be defined in the tool's inputSchema. Missing required fields: ${requiredFields.join(", ")}`,
        );
      }
    }

    for (const field of config.fields) {
      result[field.name] = field.defaultValue;
    }
    return result;
  }

  // TTY mode: display styled title
  if (config.title) {
    p.log.message(colors.bold(config.title));
  }

  for (const field of config.fields) {
    const label = field.description
      ? `${field.label} (${field.description})`
      : field.label;

    if (field.type === "boolean") {
      const value = handleCancel(
        await p.confirm({
          message: label,
          initialValue: field.defaultValue as boolean | undefined,
        }),
      );

      result[field.name] = value;
    } else if (field.type === "enum" && field.enumValues?.length) {
      const value = handleCancel(
        await p.select({
          message: label,
          options: field.enumValues.map((v) => ({
            label: v,
            value: v,
          })),
        }),
      );

      result[field.name] = value;
    } else if (field.type === "number") {
      const strValue = handleCancel(
        await p.text({
          message: label,
          defaultValue: field.defaultValue?.toString(),
          validate: (value) => {
            if (value && Number.isNaN(Number.parseFloat(value))) {
              return "Please enter a valid number";
            }
            return undefined;
          },
        }),
      );

      result[field.name] = Number.parseFloat(strValue);
    } else {
      const value = handleCancel(
        await p.text({
          message: label,
          defaultValue: field.defaultValue as string | undefined,
        }),
      );

      result[field.name] = value;
    }
  }

  return result;
}
