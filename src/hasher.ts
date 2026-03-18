import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function hashFile(root: string, filePath: string): string {
  const fullPath = path.join(root, filePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  return createHash("sha256").update(content).digest("hex");
}

export function hasChanged(oldHash: string, newHash: string): boolean {
  return oldHash !== newHash;
}
