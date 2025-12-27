import { ENV_VARS } from "../shared/constants";
import type { AppPermissions } from "../types";

/**
 * Extract permissions from a user's app script
 * This runs in the host process BEFORE launching the sandbox
 *
 * @param scriptPath - Absolute path to the user's script
 * @returns Declared permissions or undefined if not specified
 */
export async function extractAppPermissions(
  scriptPath: string,
): Promise<AppPermissions | undefined> {
  try {
    // Set environment to prevent auto-execution
    const prevMode = process.env[ENV_VARS.PROGRAMMATIC];
    process.env[ENV_VARS.PROGRAMMATIC] = "true";

    // Import the script (will call defineApp but not auto-run)
    const module = await import(scriptPath);

    // Restore environment
    if (prevMode === undefined) {
      delete process.env[ENV_VARS.PROGRAMMATIC];
    } else {
      process.env[ENV_VARS.PROGRAMMATIC] = prevMode;
    }

    // Get the app instance
    const app = module.default;

    if (!app || !app.definition) {
      return undefined;
    }

    // Return declared permissions
    return app.definition.permissions;
  } catch (error) {
    // If extraction fails, we'll ask for permissions interactively
    console.warn(
      `Warning: Could not extract permissions from ${scriptPath}:`,
      error instanceof Error ? error.message : String(error),
    );
    return undefined;
  }
}
