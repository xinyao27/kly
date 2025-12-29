export type SourceType = "local" | "remote";

export interface BinRegistryEntry {
  type: SourceType;
  remoteRef: string | null;
  localPath: string | null;
  binPath: string;
  shimPath: string;
  projectName: string;
  projectVersion: string;
  registeredAt: string;
  lastUsed: string;
  contentHash: string | null;
}

export interface BinRegistryData {
  registryVersion: number;
  commands: Record<string, BinRegistryEntry>;
}

export interface BinDetectionResult {
  /** Whether package.json has bin field */
  hasBin: boolean;
  /** Parsed bin entries: command name → bin path */
  bins: Record<string, string>;
  /** Project name from package.json */
  projectName: string;
  /** Project version from package.json */
  projectVersion: string;
}

export interface RegisterOptions {
  /** Force re-register even if command exists */
  force?: boolean;
  /** Skip user confirmation */
  skipConfirm?: boolean;
  /** Auto-update on future runs (for local projects) */
  autoUpdate?: boolean;
}

export interface UnregisterOptions {
  /** Skip user confirmation */
  skipConfirm?: boolean;
  /** Remove shim file even if not found in registry */
  force?: boolean;
}
