/**
 * Centralized constants for the KLY project
 * Prevents magic strings and improves maintainability
 */

/**
 * Environment variable names used throughout the application
 */
export const ENV_VARS = {
  MCP_MODE: "KLY_MCP_MODE",
  PROGRAMMATIC: "KLY_PROGRAMMATIC",
  LOCAL_REF: "KLY_LOCAL_REF",
  REMOTE_REF: "KLY_REMOTE_REF",
} as const;

/**
 * File and directory paths used for configuration and caching
 */
export const PATHS = {
  CONFIG_DIR: ".kly",
  META_FILE: ".kly-meta.json",
  CONFIG_FILE: "config.json",
} as const;

/**
 * Exit codes
 */
export const EXIT_CODES = {
  /** User cancelled operation (similar to SIGINT) */
  CANCELLED: 130,
} as const;
