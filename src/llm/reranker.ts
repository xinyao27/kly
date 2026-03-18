import { complete } from "@mariozechner/pi-ai";
import type { Api, Model, TextContent } from "@mariozechner/pi-ai";

import type { SearchResult } from "../database";
import { buildRerankPrompt, RERANK_SYSTEM_PROMPT } from "./prompts";

/**
 * Rerank search results using LLM.
 * Takes FTS5 candidates and returns them reordered by semantic relevance.
 */
export async function rerankResults(
  model: Model<Api>,
  query: string,
  candidates: SearchResult[],
  topK = 10,
): Promise<SearchResult[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= 1) return candidates.slice(0, topK);

  const prompt = buildRerankPrompt(
    query,
    candidates.map((c) => ({
      path: c.file.path,
      name: c.file.name,
      description: c.file.description,
      summary: c.file.summary,
    })),
  );

  const response = await complete(model, {
    systemPrompt: RERANK_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      },
    ],
  });

  const text = response.content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("");

  const rankedPaths = parseRerankResponse(text);

  // Build a path→result lookup
  const resultMap = new Map<string, SearchResult>();
  for (const candidate of candidates) {
    resultMap.set(candidate.file.path, candidate);
  }

  // Reorder by LLM ranking, then append any missing candidates at the end
  const reranked: SearchResult[] = [];
  const seen = new Set<string>();

  for (const filePath of rankedPaths) {
    const result = resultMap.get(filePath);
    if (result && !seen.has(filePath)) {
      reranked.push(result);
      seen.add(filePath);
    }
  }

  // Append candidates not mentioned by LLM (preserving original order)
  for (const candidate of candidates) {
    if (!seen.has(candidate.file.path)) {
      reranked.push(candidate);
      seen.add(candidate.file.path);
    }
  }

  return reranked.slice(0, topK);
}

/**
 * Parse the LLM rerank response into an array of file paths.
 */
export function parseRerankResponse(text: string): string[] {
  // Try to extract JSON array from response
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {
    // If JSON parse fails, try line-by-line extraction
  }

  // Fallback: extract file paths line by line
  return jsonStr
    .split("\n")
    .map((line) =>
      line
        .replace(/^[\d.)\-\s"]+/, "")
        .replace(/[",\s]+$/, "")
        .trim(),
    )
    .filter((line) => line.length > 0 && (line.includes("/") || line.includes(".")));
}
