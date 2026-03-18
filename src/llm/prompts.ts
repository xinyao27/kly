export const INDEXING_SYSTEM_PROMPT = `You are a code indexing assistant. Your job is to analyze source code files and generate structured metadata.

For each file, you must return a JSON object with exactly these fields:
- "name": A short, descriptive name for the file (e.g., "User Authentication Service")
- "description": A one-line description of what this file does
- "summary": A 2-3 sentence summary of the file's purpose and key functionality
- "symbols": An array of symbol descriptions, each with "name" and "description"

Rules:
- Be concise and precise
- Focus on what the code DOES, not how it's structured
- Symbol descriptions should explain the purpose, not restate the signature
- Return ONLY valid JSON, no markdown or explanation`;

export function buildIndexingPrompt(
  filePath: string,
  content: string,
  symbols: { name: string; kind: string }[],
): string {
  const symbolList = symbols.map((s) => `- ${s.kind}: ${s.name}`).join("\n");

  return `Analyze this source file and generate indexing metadata.

File: ${filePath}
Detected symbols:
${symbolList}

Source code:
\`\`\`
${content}
\`\`\`

Return a JSON object with: name, description, summary, and symbols (array with name + description for each detected symbol).`;
}
