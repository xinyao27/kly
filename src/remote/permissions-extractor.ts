import type { AppPermissions } from "../types";
import { log } from "../ui";

/**
 * Extract declared permissions from a remote app
 *
 * This function safely loads the app definition to read its declared permissions
 * WITHOUT executing the actual tool logic.
 *
 * @param entryPath - Absolute path to the app entry point
 * @returns Declared permissions or undefined if not specified
 */
export async function extractAppPermissions(
  entryPath: string,
): Promise<AppPermissions | undefined> {
  try {
    // Temporarily mark as programmatic mode to avoid triggering CLI logic
    const prevProgrammatic = process.env.KLY_PROGRAMMATIC;
    process.env.KLY_PROGRAMMATIC = "true";

    // Dynamic import to load the app module
    const appModule = await import(entryPath);

    // Restore environment
    if (prevProgrammatic === undefined) {
      delete process.env.KLY_PROGRAMMATIC;
    } else {
      process.env.KLY_PROGRAMMATIC = prevProgrammatic;
    }

    // The app module should export a KlyApp instance
    // which has a definition.permissions field
    if (appModule.default?.definition) {
      return appModule.default.definition.permissions;
    }

    // Some apps might export the app directly
    if (appModule.definition) {
      return appModule.definition.permissions;
    }

    return undefined;
  } catch (error) {
    // If we can't extract permissions, return undefined
    // The calling code will fall back to asking for all permissions
    log.warn(
      `⚠️  Could not extract permissions from app (${error instanceof Error ? error.message : "unknown error"})`,
    );
    return undefined;
  }
}
