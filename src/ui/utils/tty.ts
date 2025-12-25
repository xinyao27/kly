/**
 * Check if we're in a TTY environment
 * Returns false in CI or non-interactive environments
 */
export function isTTY(): boolean {
  return Boolean(
    process.stdout.isTTY && process.stdin.isTTY && !process.env.CI,
  );
}
