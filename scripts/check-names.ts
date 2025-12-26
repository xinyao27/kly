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
  "clix", // cli + x
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
    // Try to fetch the domain with a short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // Reduced timeout

    const response = await fetch(`http://${domain}`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    }).catch(() => null);

    clearTimeout(timeoutId);

    // If we get any response, domain has DNS records (taken)
    const isAvailable = response === null;

    cache.domains[domain] = isAvailable;
    return isAvailable;
  } catch (_error) {
    // Timeout or network error likely means no DNS record
    cache.domains[domain] = true; // Assume available
    return true;
  }
}

async function checkDomainsForName(
  name: string,
  cache: CacheData,
): Promise<Array<{ domain: string; available: boolean | null }>> {
  // Check all domains in parallel for speed
  const checks = DOMAIN_SUFFIXES.map(async (suffix) => {
    const domain = `${name}${suffix}`;
    const available = await checkDomainAvailability(domain, cache);
    return { domain, available };
  });

  return Promise.all(checks);
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
