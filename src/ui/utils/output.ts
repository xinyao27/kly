import { formatText } from "./colors";

/**
 * Output a result to the console
 *
 * @param result - The result to display (string, object, etc.)
 */
export function output(result: unknown): void {
  if (result === undefined || result === null) {
    return;
  }

  if (typeof result === "string") {
    console.log(result);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Display an error message with optional suggestions
 *
 * @param message - Error message
 * @param suggestions - Optional suggestions for fixing the error
 */
export function error(message: string, suggestions?: string[]): void {
  console.error(
    `${formatText("Error:", { color: "red", bold: true })} ${message}`,
  );

  if (suggestions?.length) {
    console.error("");
    console.error(formatText("Suggestions:", { dim: true }));
    for (const suggestion of suggestions) {
      console.error(`  ${formatText("•", { dim: true })} ${suggestion}`);
    }
  }
}

/**
 * Display help text
 *
 * @param content - Help text content
 */
export function help(content: string): void {
  console.log(content);
}
