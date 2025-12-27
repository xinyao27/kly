/**
 * Runtime mode detection utilities
 * Centralizes environment variable checks for different execution modes
 */

import type { RuntimeMode } from "../types";
import { ENV_VARS } from "./constants";

/**
 * Check if running in sandbox mode
 * Sandbox mode: Isolated child process with restricted permissions
 */
export function isSandbox(): boolean {
  return process.env[ENV_VARS.SANDBOX_MODE] === "true";
}

/**
 * Check if running in MCP (Model Context Protocol) mode
 * MCP mode: Running as an MCP server for Claude Desktop integration
 */
export function isMCP(): boolean {
  return process.env[ENV_VARS.MCP_MODE] === "true";
}

/**
 * Check if running in programmatic mode
 * Programmatic mode: Imported as a library in another application
 */
export function isProgrammatic(): boolean {
  return process.env[ENV_VARS.PROGRAMMATIC] === "true";
}

/**
 * Check if running with trust all flag
 * Trust all: Skip permission prompts (for testing/automation)
 */
export function isTrustAll(): boolean {
  return process.env[ENV_VARS.TRUST_ALL] === "true";
}

/**
 * Get local reference environment variable
 */
export function getLocalRef(): string | undefined {
  return process.env[ENV_VARS.LOCAL_REF];
}

/**
 * Get remote reference environment variable
 */
export function getRemoteRef(): string | undefined {
  return process.env[ENV_VARS.REMOTE_REF];
}

/**
 * Detect the current runtime mode
 * This is the canonical implementation that should be used throughout the app
 */
export function detectMode(): RuntimeMode {
  // Sandbox mode: Running inside sandboxed child process
  if (isSandbox()) {
    return "cli"; // Sandbox always runs in CLI mode
  }

  // MCP mode: Check for MCP environment variable
  if (isMCP()) {
    return "mcp";
  }

  // Programmatic mode: Check for explicit flag
  if (isProgrammatic()) {
    return "programmatic";
  }

  // CLI mode: Running a .ts file directly with bun
  const scriptPath = process.argv[1] ?? "";
  const isDirectRun = scriptPath.endsWith(".ts") || scriptPath.endsWith(".js");
  if (isDirectRun) {
    return "cli";
  }

  // Default to programmatic (e.g., when imported as a module)
  return "programmatic";
}
