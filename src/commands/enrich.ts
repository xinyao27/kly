import { enrichErrorStack } from "../enrich";
import { openDatabase } from "../store";
import type { ErrorFrame } from "../types";
import { error, output } from "./output";
import { ensureInitialized } from "./shared";

export interface EnrichOptions {
  frames?: string;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);

    // If stdin is a TTY (no pipe), error immediately
    if (process.stdin.isTTY) {
      reject(new Error("no input"));
    }
  });
}

function parseFrames(input: string): ErrorFrame[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    error(
      "Invalid JSON input.",
      'echo \'[{"file":"src/foo.ts","line":42}]\' | kly enrich',
    );
  }

  if (!Array.isArray(parsed)) {
    error(
      "Input must be a JSON array of ErrorFrame objects.",
      'kly enrich --frames \'[{"file":"src/foo.ts","line":42}]\'',
    );
  }

  for (const [i, frame] of parsed.entries()) {
    if (!frame.file || typeof frame.file !== "string") {
      error(`Frame ${i}: missing or invalid "file" field.`);
    }
    if (typeof frame.line !== "number") {
      error(`Frame ${i}: missing or invalid "line" field.`);
    }
  }

  return parsed as ErrorFrame[];
}

export async function runEnrich(root: string, options: EnrichOptions = {}): Promise<void> {
  ensureInitialized(root);

  let input: string;

  if (options.frames) {
    input = options.frames;
  } else {
    try {
      input = await readStdin();
    } catch {
      error(
        "No input provided. Pass frames via --frames or stdin.",
        'echo \'[{"file":"src/foo.ts","line":42}]\' | kly enrich\n  kly enrich --frames \'[{"file":"src/foo.ts","line":42}]\'',
      );
    }
  }

  const frames = parseFrames(input.trim());

  if (frames.length === 0) {
    error("Empty frames array.");
  }

  const db = openDatabase(root);
  try {
    const result = enrichErrorStack(db, root, frames);
    // enrich always outputs JSON (structured data, no pretty mode)
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    db.close();
  }
}
