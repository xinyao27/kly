import * as p from "@clack/prompts";
import { ExitWarning } from "../../shared/errors";

/**
 * Handle cancel action for prompts
 * If the value is a cancel symbol, throws ExitWarning
 * Otherwise returns the value
 */
export function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    throw new ExitWarning();
  }
  return value;
}
