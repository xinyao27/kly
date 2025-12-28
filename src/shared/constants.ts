/**
 * Centralized constants for the KLY project
 * Prevents magic strings and improves maintainability
 */

/**
 * Environment variable names used throughout the application
 */
export const ENV_VARS = {
  SANDBOX_MODE: "KLY_SANDBOX_MODE",
  MCP_MODE: "KLY_MCP_MODE",
  PROGRAMMATIC: "KLY_PROGRAMMATIC",
  TRUST_ALL: "KLY_TRUST_ALL",
  LOCAL_REF: "KLY_LOCAL_REF",
  REMOTE_REF: "KLY_REMOTE_REF",
} as const;

/**
 * File and directory paths used for configuration and caching
 */
export const PATHS = {
  CONFIG_DIR: ".kly",
  META_FILE: ".kly-meta.json",
  PERMISSIONS_FILE: "permissions.json",
  CONFIG_FILE: "config.json",
} as const;

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Standard IPC request timeout (30 seconds) */
  IPC_REQUEST: 30_000,
  /** Long-running IPC request timeout (60 seconds) */
  IPC_LONG_REQUEST: 60_000,
} as const;

/**
 * LLM API domains for network permission configuration
 */
export const LLM_API_DOMAINS = [
  "api.openai.com",
  "*.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.deepseek.com",
] as const;
