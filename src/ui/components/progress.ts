import pc from "picocolors";
import { isTTY } from "../utils/tty";

/**
 * Handle for controlling a progress bar
 */
export interface ProgressHandle {
  /** Update progress value (0-100 or custom total) */
  update(current: number, message?: string): void;
  /** Mark progress as complete */
  complete(message?: string): void;
  /** Mark progress as failed */
  fail(message?: string): void;
}

/**
 * Configuration for progress component
 */
export interface ProgressConfig {
  /** Total value (default: 100 for percentage) */
  total?: number;
  /** Initial message */
  message?: string;
  /** Bar width in characters (default: 30) */
  width?: number;
}

/**
 * Create a progress bar for showing completion status
 *
 * @example
 * ```typescript
 * const progress = createProgress({ total: 100, message: "Downloading..." });
 * for (let i = 0; i <= 100; i += 10) {
 *   await delay(100);
 *   progress.update(i);
 * }
 * progress.complete("Download complete!");
 * ```
 */
export function createProgress(config: ProgressConfig = {}): ProgressHandle {
  const total = config.total ?? 100;
  const width = config.width ?? 30;
  let currentMessage = config.message ?? "";
  let lastOutput = "";

  const renderBar = (current: number): string => {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = `${pc.green("█".repeat(filled))}${pc.dim("░".repeat(empty))}`;
    return `${bar} ${pc.cyan(`${percentage}%`)}`;
  };

  const render = (current: number, message?: string) => {
    if (!isTTY()) {
      return;
    }

    const msg = message ?? currentMessage;
    const bar = renderBar(current);
    const output = msg ? `${bar} ${pc.dim(msg)}` : bar;

    // Clear previous line and write new one
    if (lastOutput) {
      process.stdout.write("\r\x1b[K");
    }
    process.stdout.write(output);
    lastOutput = output;
  };

  return {
    update(current: number, message?: string) {
      if (message) {
        currentMessage = message;
      }
      render(current, message);
    },

    complete(message?: string) {
      if (!isTTY()) {
        return;
      }
      process.stdout.write("\r\x1b[K");
      const bar = renderBar(total);
      const msg = message ?? "Complete";
      console.log(`${bar} ${pc.green("✓")} ${msg}`);
    },

    fail(message?: string) {
      if (!isTTY()) {
        return;
      }
      process.stdout.write("\r\x1b[K");
      const msg = message ?? "Failed";
      console.log(`${pc.red("✗")} ${msg}`);
    },
  };
}
