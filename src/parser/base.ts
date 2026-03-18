import type { ParseResult } from "../types";

export abstract class BaseParser {
  abstract readonly extensions: string[];

  abstract parse(content: string, filePath: string): ParseResult;

  supports(filePath: string): boolean {
    return this.extensions.some((ext) => filePath.endsWith(ext));
  }
}
