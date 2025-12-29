import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "../ui";
import type { BinDetectionResult } from "./types";

export function detectBins(projectPath: string): BinDetectionResult {
  const pkgPath = join(projectPath, "package.json");

  if (!existsSync(pkgPath)) {
    return {
      hasBin: false,
      bins: {},
      projectName: "unknown",
      projectVersion: "0.0.0",
    };
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const projectName = pkg.name || "unknown";
    const projectVersion = pkg.version || "0.0.0";

    if (!pkg.bin) {
      return {
        hasBin: false,
        bins: {},
        projectName,
        projectVersion,
      };
    }

    // Handle two formats:
    // 1. String: { "bin": "./cli.js" } - command name = package name
    // 2. Object: { "bin": { "mycmd": "./cli.js", "other": "./other.js" } }

    let bins: Record<string, string> = {};

    if (typeof pkg.bin === "string") {
      // Single bin, use package name as command
      bins[projectName] = pkg.bin;
    } else if (typeof pkg.bin === "object" && pkg.bin !== null) {
      // Multiple bins
      bins = { ...pkg.bin };
    }

    return {
      hasBin: Object.keys(bins).length > 0,
      bins,
      projectName,
      projectVersion,
    };
  } catch (error) {
    log.warn(`Failed to parse package.json: ${error}`);
    return {
      hasBin: false,
      bins: {},
      projectName: "unknown",
      projectVersion: "0.0.0",
    };
  }
}

export function isCommandAvailable(commandName: string): boolean {
  // Check if command already exists in system
  // Use `which` or `command -v` to check
  try {
    const { spawnSync } = require("node:child_process");
    const result = spawnSync("command", ["-v", commandName], {
      shell: true,
      encoding: "utf-8",
    });
    return result.status === 0;
  } catch {
    return false;
  }
}
