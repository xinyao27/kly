import { isInitialized } from "../config";
import { error } from "./output";

export function ensureInitialized(root: string): void {
  if (!isInitialized(root)) {
    error("Not initialized.", "kly init --provider <provider> --api-key <key>");
  }
}
