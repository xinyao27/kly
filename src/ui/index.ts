// Interactive components
export {
  type AutocompleteConfig,
  type AutocompleteOption,
  autocomplete,
} from "./components/autocomplete";
export {
  type AutocompleteMultiselectConfig,
  autocompleteMultiselect,
} from "./components/autocompleteMultiselect";
export { confirm } from "./components/confirm";
export { type FormConfig, type FormField, form } from "./components/form";
export { type InputConfig, input } from "./components/input";
export { cancel, error, help, intro, isCancel, log, note, output, outro } from "./components/log";
export {
  type MultiSelectConfig,
  type MultiSelectOption,
  multiselect,
} from "./components/multiselect";
export { type PasswordConfig, password } from "./components/password";
export { createProgress, type ProgressConfig, type ProgressHandle } from "./components/progress";
// Raw prompts for manual cancel handling (e.g., IPC handlers)
export {
  isCancel as rawIsCancel,
  rawConfirm,
  rawMultiselect,
  rawPassword,
  rawSelect,
  rawText,
} from "./components/prompts";
export { type SelectConfig, type SelectOption, select } from "./components/select";
export { type SpinnerHandle, spinner } from "./components/spinner";
export { type ColumnAlign, type TableColumn, type TableConfig, table } from "./components/table";
export { type Task, type TaskResult, tasks } from "./components/tasks";
export { type TextConfig, text } from "./components/text";

// Utilities
export { type AnsiColor, colors, formatText, theme } from "./utils/colors";
export { isTTY } from "./utils/tty";
