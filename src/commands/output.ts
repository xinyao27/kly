/**
 * Unified output utilities for all CLI commands.
 *
 * Default: JSON to stdout (agent-first).
 * --pretty: Human-readable to stdout.
 * Errors/warnings: always to stderr.
 */

export interface OutputOptions {
  pretty?: boolean;
}

/** Output data as JSON (default) or human-readable (--pretty). */
export function output(
  data: unknown,
  opts: OutputOptions,
  prettyFormatter?: (data: unknown) => string,
): void {
  if (opts.pretty && prettyFormatter) {
    process.stdout.write(prettyFormatter(data) + "\n");
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }
}

/** Output error to stderr and exit. Optionally show a hint with correct usage. */
export function error(message: string, hint?: string): never {
  let msg = `Error: ${message}`;
  if (hint) {
    msg += `\n  ${hint}`;
  }
  process.stderr.write(msg + "\n");
  process.exit(1);
}

/** Output warning to stderr. */
export function warn(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
}

/** Output info to stderr (for progress/status messages that shouldn't pollute stdout). */
export function info(message: string): void {
  process.stderr.write(`${message}\n`);
}
