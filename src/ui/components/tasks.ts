import * as p from "@clack/prompts";
import { isTTY } from "../utils/tty";

/**
 * Task definition for the tasks runner
 */
export interface Task<T = unknown> {
  /** Task title shown in spinner */
  title: string;
  /** Async function to execute */
  task: (message: (msg: string) => void) => Promise<T>;
  /** Whether task is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Result of a task execution
 */
export interface TaskResult<T = unknown> {
  /** Task title */
  title: string;
  /** Whether task succeeded */
  success: boolean;
  /** Task result if successful */
  result?: T;
  /** Error if failed */
  error?: Error;
}

/**
 * Execute multiple tasks sequentially with spinners
 *
 * @example
 * ```typescript
 * const results = await tasks([
 *   {
 *     title: "Installing dependencies",
 *     task: async (message) => {
 *       message("Fetching packages...");
 *       await install();
 *       return { installed: 42 };
 *     }
 *   },
 *   {
 *     title: "Building project",
 *     task: async () => {
 *       await build();
 *     }
 *   }
 * ]);
 * ```
 */
export async function tasks<T extends readonly Task[]>(taskList: T): Promise<TaskResult[]> {
  const results: TaskResult[] = [];

  for (const task of taskList) {
    // Skip disabled tasks
    if (task.enabled === false) {
      continue;
    }

    if (!isTTY()) {
      // Non-TTY: just run tasks without spinners
      try {
        const result = await task.task(() => {});
        results.push({
          title: task.title,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          title: task.title,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
      continue;
    }

    // TTY: use spinner
    const spinner = p.spinner();
    spinner.start(task.title);

    try {
      const result = await task.task((msg: string) => {
        spinner.message(msg);
      });

      spinner.stop(`${task.title}`);
      results.push({
        title: task.title,
        success: true,
        result,
      });
    } catch (error) {
      spinner.stop(`${task.title} - Failed`);
      results.push({
        title: task.title,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return results;
}
