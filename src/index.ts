export { defineApp } from "./define-app";
export type { JsonSchema } from "./mcp";
// MCP exports
export { startMcpServer } from "./mcp";
export { tool } from "./tool";
export type {
  AnyTool,
  AppDefinition,
  AppPermissions,
  ExecuteContext,
  InferOutput,
  KlyApp,
  ModelConfig,
  ModelInfo,
  ModelsContext,
  RuntimeMode,
  StandardSchemaV1,
  Tool,
  ToolDefinition,
} from "./types";
export { ValidationError } from "./types";

// UI exports - functional API
export type {
  ColumnAlign,
  FormConfig,
  FormField,
  InputConfig,
  SelectOption,
  SpinnerHandle,
  TableColumn,
  TableConfig,
} from "./ui";
export {
  color,
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
  table,
  theme,
} from "./ui";
