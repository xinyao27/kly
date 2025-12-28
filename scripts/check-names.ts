#!/usr/bin/env bun

/**
 * Name availability checker for npm packages and domains
 * Usage: bun run scripts/check-names.ts
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NAMES_TO_CHECK } from "./.cache/names-to-check";

const DOMAIN_SUFFIXES = [
  ".com",
  ".dev",
  ".sh",
  ".io",
  ".app",
  ".run",
  ".ai",
  ".tools",
  ".so",
  ".co",
];

const CACHE_DIR = join(import.meta.dir, ".cache");
const CACHE_FILE = join(CACHE_DIR, "name-checks.json");

// ============ Types ============

interface CacheData {
  npm: Record<string, boolean>; // name -> isAvailable
  domains: Record<string, boolean | null>; // domain -> isAvailable
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
