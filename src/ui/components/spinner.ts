import * as p from "@clack/prompts";

/**
 * Handle for controlling a spinner
 */
export interface SpinnerHandle {
  /** Update spinner message */
  update(message: string): void;
  /** Mark as successful and stop */
  succeed(message?: string): void;
  /** Mark as failed and stop */
  fail(message?: string): void;
  /** Stop spinner without status */
  stop(): void;
}

/**
 * Create a spinner for showing progress
 *
 * @example
 * ```typescript
 * const spin = spinner("Loading...");
 * await doSomething();
 * spin.succeed("Done!");
 * ```
 */
export function spinner(message: string): SpinnerHandle {
  const instance = p.spinner();
  instance.start(message);

  return {
    update(msg: string) {
      instance.message(msg);
    },

    succeed(msg?: string) {
      instance.stop(msg ?? message);
    },

    fail(msg?: string) {
      instance.stop(msg ?? message);
    },

    stop() {
      instance.stop();
    },
  };
}
