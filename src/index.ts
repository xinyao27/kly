export { defineApp } from "./define-app";
export type { JsonSchema } from "./mcp";
// MCP exports
export { startMcpServer } from "./mcp";
export { tool } from "./tool";
export type {
  AnyTool,
  AppDefinition,
  ClaiApp,
  ExecuteContext,
  InferOutput,
  RuntimeMode,
  StandardSchemaV1,
  Tool,
  ToolDefinition,
} from "./types";
export { ValidationError } from "./types";

// UI exports - functional API
export type {
  FormConfig,
  FormField,
  InputConfig,
  SelectOption,
  SpinnerHandle,
} from "./ui";
export {
  confirm,
  error,
  form,
  formatText,
  help,
  input,
  isTTY,
  output,
  select,
  spinner,
  theme,
} from "./ui";
