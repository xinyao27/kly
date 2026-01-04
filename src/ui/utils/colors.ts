import * as colors from "xycolors";

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

export type AnsiColor = "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray";

/**
 * Color mapping for formatText function
 */
const colorMap: Record<AnsiColor, (text: string) => string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
  magenta: colors.magenta,
  cyan: colors.cyan,
  white: colors.white,
  gray: colors.gray,
};

/**
 * Format text with xycolors
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
    result = colorMap[options.color](result);
  }

  // Apply styles
  if (options?.bold) result = colors.bold(result);
  if (options?.dim) result = colors.dim(result);
  if (options?.italic) result = colors.italic(result);
  if (options?.underline) result = colors.underline(result);

  return result;
}

export { colors };
