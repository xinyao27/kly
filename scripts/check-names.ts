#!/usr/bin/env bun

/**
 * Name availability checker for npm packages and domains
 * Usage: bun run scripts/check-names.ts
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ============ Configuration ============

const NAMES_TO_CHECK = [
  // CLI + AI combinations
  "clai", // CLI + AI (current name)
  "clia", // CLI + A
  "aicli", // AI + CLI
  "aic", // AI + Command
  "cai", // Command + AI

  // Unix/X style AI variants
  "aix", // AI + X
  "clix", // CLI + X
  "claix", // CLI + AI + X

  // Minimal (2-3 letters)
  "lai", // Line + AI
  "sai", // Shell + AI
  "tai", // Terminal + AI
  "vai", // V + AI
  "zai", // Z + AI

  // New: Phonetic CLI variants
  "kli", // sounds like CLI
  "klai", // K + L + AI
  "qli", // Q (query) + LI

  // New: [letter] + IA pattern
  "lia", // Line Intelligence Assistant
  "tia", // Terminal Intelligence Assistant
  "sia", // Shell Intelligence Assistant
  "ria", // Runtime Intelligence Assistant
  "mia", // Machine Intelligence Assistant
  "pia", // ? Intelligence Assistant
  "nia", // ? Intelligence Assistant

  // New: [letter] + AI pattern (more variants)
  "kai", // K + AI
  "jai", // J + AI
  "rai", // R + AI
  "wai", // W + AI
  "xai", // X + AI (eXplainable AI)

  // New: Minimal X combinations
  "ix", // Intelligence + X
  "cx", // Command + X
  "ax", // AI + X
  "lix", // Line + X
  "pix", // ? + X
  "mix", // Multi + X
  "vix", // ? + X
  "zix", // Z + X

  // New: Two-letter + ai pattern
  "hai", // Help + AI
  "dai", // Dev + AI
  "bai", // Build + AI
  "fai", // Flow + AI
  "gai", // Go + AI
  "pai", // ? + AI
  "mai", // ? + AI
  "oai", // Open + AI
  "uai", // Universal + AI
  "qai", // Query + AI
  "yai", // Your + AI

  // New: Three-letter x endings (Unix style)
  "cax", // Command + A + X
  "dax", // Dev + A + X
  "gax", // Go + A + X
  "jax", // ? + X
  "lax", // Line + A + X
  "pax", // ? + X
  "rax", // Run + A + X
  "wax", // ? + X
  "yax", // ? + X
  "zax", // Z + A + X

  // New: ai prefix variations
  "aiq", // AI + Query
  "aik", // AI + Kit
  "aio", // AI + O
  "aip", // AI + P
  "ait", // AI + Terminal

  // New: Ultra minimal (2 letters)
  "qi", // 气 (Chinese: energy/qi)
  "xi", // ξ (Greek letter)
  "zo", // Z + O
  "ko", // K + O

  // New: CLI phonetic variants
  "kly", // sounds like CLI
  "cly", // variant of CLI
  "kla", // K + LA

  // Creative/Phonetic
  "cliq", // sounds like "click"
  "clasp", // CLI + ASP
  "clue", // gives clues
  "clio", // muse of history / CLI + O

  // Original suggestions
  "unitool",
  "onecli",
  "omnitool",
  "trini",
  "trifecta",
  "prism",
  "runkit",
  "apprun",
  "termbase",
  "flux",
  "apex",
  "onyx",
  "nexus",

  // Unix/X style
  "trinix", // trini + x (unix style)
  "toolx", // tool + x
  "kernix", // kernel + x
  "basex", // base + x

  // Trinity variants
  "trikit", // trinity + kit
  "trine", // variant of trinity
  "trio", // three/trio
  "tripod", // three-legged (stable)
  "tribase", // trinity + base
  "trimix", // trinity + mix

  // Universal/Uni prefix
  "unikit", // universal kit
  "unibase", // universal base
  "uniflow", // universal flow
  "unify", // unification

  // Kit/Tool suffix
  "clikit", // cli kit

  // Concept names
  "vertex", // point of connection
  "zenith", // peak/summit
  "synth", // synthesis/combination
  "forge", // tool builder
  "craft", // building tools
  "weave", // weaving capabilities together

  // Meta/Core prefix
  "metatool", // meta tool
  "coretool", // core tool
  "polytool", // poly (many) tool
  "adaptool", // adaptive tool
];

const DOMAIN_SUFFIXES = [
  ".com",
  ".dev",
  ".sh",
  ".io",
  ".app",
  ".run",
  ".ai",
  ".tools",
];

const CACHE_DIR = join(import.meta.dir, ".cache");
const CACHE_FILE = join(CACHE_DIR, "name-checks.json");

// ============ Types ============

interface CacheData {
  npm: Record<string, boolean>; // name -> isAvailable
  domains: Record<string, boolean>; // domain -> isAvailable
  timestamp: number;
}

interface CheckResult {
  name: string;
  npmAvailable: boolean | null;
  domains: Array<{
    domain: string;
    available: boolean | null;
  }>;
}

// ============ Cache Management ============

async function loadCache(): Promise<CacheData> {
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }

    if (existsSync(CACHE_FILE)) {
      const content = await readFile(CACHE_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Failed to load cache:", error);
  }

  return {
    npm: {},
    domains: {},
    timestamp: Date.now(),
  };
}

async function saveCache(cache: CacheData): Promise<void> {
  try {
    cache.timestamp = Date.now();
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
}

// ============ NPM Checker ============

async function checkNpmAvailability(
  name: string,
  cache: CacheData,
): Promise<boolean | null> {
  // Check cache first
  if (name in cache.npm) {
    console.log(`  [NPM] ${name} (cached)`);
    return cache.npm[name] ?? null;
  }

  try {
    const response = await fetch(`https://registry.npmjs.org/${name}`, {
      method: "HEAD",
    });

    // 404 means available, 200 means taken
    const isAvailable = response.status === 404;
    cache.npm[name] = isAvailable;

    console.log(
      `  [NPM] ${name} - ${isAvailable ? "✅ Available" : "❌ Taken"}`,
    );
    return isAvailable;
  } catch (error) {
    console.error(`  [NPM] ${name} - ⚠️  Error checking:`, error);
    return null;
  }
}

// ============ Domain Checker ============

async function checkDomainAvailability(
  domain: string,
  cache: CacheData,
): Promise<boolean | null> {
  // Check cache first
  if (domain in cache.domains) {
    return cache.domains[domain] ?? null;
  }

  try {
    // Use whois command to check domain registration status
    const proc = Bun.spawn(["whois", domain], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    // If whois command failed, return unknown
    if (exitCode !== 0) {
      console.log(`  [Domain] ${domain} - ⚠️  whois failed`);
      return null;
    }

    // Parse whois output to determine availability
    const outputLower = output.toLowerCase();

    // Common patterns indicating domain is available
    const availablePatterns = [
      "no match",
      "not found",
      "no data found",
      "no entries found",
      "status: free",
      "status: available",
      "no match for domain",
      "not registered",
      "no information available",
    ];

    // Common patterns indicating domain is taken
    const takenPatterns = [
      "registrar:",
      "creation date:",
      "created:",
      "registered:",
      "domain name:",
      "status: registered",
      "status: active",
    ];

    // Check if domain is available
    const isAvailable = availablePatterns.some((pattern) =>
      outputLower.includes(pattern),
    );

    // Double check if domain is taken
    const isTaken = takenPatterns.some((pattern) =>
      outputLower.includes(pattern),
    );

    // If we found clear evidence, use it
    let result: boolean | null = null;
    if (isAvailable && !isTaken) {
      result = true;
    } else if (isTaken) {
      result = false;
    }

    cache.domains[domain] = result;
    return result;
  } catch (error) {
    console.log(`  [Domain] ${domain} - ⚠️  Error: ${error}`);
    return null;
  }
}

async function checkDomainsForName(
  name: string,
  cache: CacheData,
): Promise<Array<{ domain: string; available: boolean | null }>> {
  const results: Array<{ domain: string; available: boolean | null }> = [];

  // Check domains sequentially to avoid rate limiting and show progress
  for (const suffix of DOMAIN_SUFFIXES) {
    const domain = `${name}${suffix}`;

    // Check cache first to determine if we need to show progress
    const isCached = domain in cache.domains;

    if (isCached) {
      const available = cache.domains[domain] ?? null;
      results.push({ domain, available });
    } else {
      // Show progress for uncached queries
      process.stdout.write(`  [Domain] Checking ${domain}...`);
      const available = await checkDomainAvailability(domain, cache);

      // Clear the progress line
      process.stdout.write(`\r${" ".repeat(60)}\r`);

      // Show result
      const status =
        available === true ? "✅" : available === false ? "❌" : "⚠️";
      console.log(`  [Domain] ${domain} - ${status}`);

      results.push({ domain, available });
    }
  }

  return results;
}

// ============ Main Logic ============

async function checkName(name: string, cache: CacheData): Promise<CheckResult> {
  console.log(`\n🔍 Checking: ${name}`);

  const npmAvailable = await checkNpmAvailability(name, cache);
  const domains = await checkDomainsForName(name, cache);

  return {
    name,
    npmAvailable,
    domains,
  };
}

function printResults(results: CheckResult[]): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log("📊 Summary Report");
  console.log(`${"=".repeat(80)}\n`);

  for (const result of results) {
    console.log(`📦 ${result.name}`);
    console.log(
      `   NPM: ${result.npmAvailable ? "✅ Available" : result.npmAvailable === false ? "❌ Taken" : "⚠️  Unknown"}`,
    );
    console.log("   Domains:");

    const availableDomains = result.domains.filter((d) => d.available);
    const takenDomains = result.domains.filter((d) => d.available === false);
    const unknownDomains = result.domains.filter((d) => d.available === null);

    if (availableDomains.length > 0) {
      console.log(
        `      ✅ Available: ${availableDomains.map((d) => d.domain).join(", ")}`,
      );
    }
    if (takenDomains.length > 0) {
      console.log(
        `      ❌ Taken: ${takenDomains.map((d) => d.domain).join(", ")}`,
      );
    }
    if (unknownDomains.length > 0) {
      console.log(
        `      ⚠️  Unknown: ${unknownDomains.map((d) => d.domain).join(", ")}`,
      );
    }
    console.log();
  }

  // Find best options
  const bestOptions = results.filter(
    (r) =>
      r.npmAvailable === true &&
      r.domains.some((d) => d.available && d.domain.match(/\.(com|dev|sh)$/)),
  );

  if (bestOptions.length > 0) {
    console.log("🌟 Best Options (NPM + good domain available):");
    for (const option of bestOptions) {
      const goodDomains = option.domains
        .filter((d) => d.available && d.domain.match(/\.(com|dev|sh)$/))
        .map((d) => d.domain);
      console.log(`   • ${option.name}: ${goodDomains.join(", ")}`);
    }
    console.log();
  }
}

// ============ Entry Point ============

async function main() {
  console.log("🚀 Name Availability Checker");
  console.log(`=${"=".repeat(79)}`);
  console.log(`Checking ${NAMES_TO_CHECK.length} names...`);
  console.log(`Domain suffixes: ${DOMAIN_SUFFIXES.join(", ")}\n`);

  const cache = await loadCache();
  const results: CheckResult[] = [];

  for (const name of NAMES_TO_CHECK) {
    const result = await checkName(name, cache);
    results.push(result);
  }

  await saveCache(cache);
  printResults(results);

  console.log(`💾 Cache saved to: ${CACHE_FILE}`);
}

main().catch(console.error);
