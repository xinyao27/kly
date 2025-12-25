import pc from "picocolors";

/**
 * Default color theme for UI components (hex values for reference)
 */
export const theme = {
  // Brand colors
  primary: "#3b82f6", // Blue
  success: "#10b981", // Green
  warning: "#f59e0b", // Orange
  error: "#ef4444", // Red
  info: "#06b6d4", // Cyan

  // UI colors
  background: "#161b22", // Dark gray
  surface: "#1e293b", // Lighter gray
  border: "#30363d", // Border gray
  text: "#c9d1d9", // Light text
  textDim: "#8b949e", // Dimmed text
  textBright: "#ffffff", // Bright text

  // Interactive states
  focused: "#3b82f6", // Blue
  selected: "#3b82f6", // Blue
  hover: "#334155", // Lighter gray
  disabled: "#6e7681", // Muted gray
} as const;

export type AnsiColor =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray";

/**
 * Format text with picocolors
 */
export function formatText(
  text: string,
  options?: {
    color?: AnsiColor;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
  },
): string {
  let result = text;

  // Apply color first
  if (options?.color) {
    switch (options.color) {
      case "red":
        result = pc.red(result);
        break;
      case "green":
        result = pc.green(result);
        break;
      case "yellow":
        result = pc.yellow(result);
        break;
      case "blue":
        result = pc.blue(result);
        break;
      case "magenta":
        result = pc.magenta(result);
        break;
      case "cyan":
        result = pc.cyan(result);
        break;
      case "white":
        result = pc.white(result);
        break;
      case "gray":
        result = pc.gray(result);
        break;
    }
  }

  // Apply styles
  if (options?.bold) result = pc.bold(result);
  if (options?.dim) result = pc.dim(result);
  if (options?.italic) result = pc.italic(result);
  if (options?.underline) result = pc.underline(result);

  return result;
}

// Re-export picocolors for direct usage
export { pc };
