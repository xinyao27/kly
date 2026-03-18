import type { Language, ParseResult } from "../types.js";
import { BaseParser } from "./base.js";
import { SwiftParser } from "./swift.js";
import { TypeScriptParser } from "./typescript.js";

const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".swift": "swift",
};

export class ParserManager {
  private parsers: BaseParser[];

  constructor() {
    this.parsers = [new TypeScriptParser(), new SwiftParser()];
  }

  getParser(filePath: string): BaseParser | undefined {
    return this.parsers.find((p) => p.supports(filePath));
  }

  parse(content: string, filePath: string): ParseResult | null {
    const parser = this.getParser(filePath);
    if (!parser) return null;
    return parser.parse(content, filePath);
  }

  getLanguage(filePath: string): Language | undefined {
    const ext = filePath.slice(filePath.lastIndexOf("."));
    return EXTENSION_TO_LANGUAGE[ext];
  }
}

export { BaseParser } from "./base.js";
export { SwiftParser } from "./swift.js";
export { TypeScriptParser } from "./typescript.js";
