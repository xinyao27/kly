import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { log } from "../ui";
import type { BinRegistryData, BinRegistryEntry } from "./types";

let cachedRegistry: BinRegistryData | null = null;
let cacheMtime = 0;

export function getRegistryPath(): string {
  return join(homedir(), ".kly", "bin-registry.yaml");
}

export function readRegistry(): BinRegistryData {
  const registryPath = getRegistryPath();

  if (existsSync(registryPath)) {
    const currentMtime = statSync(registryPath).mtimeMs;

    if (cachedRegistry && cacheMtime === currentMtime) {
      return cachedRegistry;
    }

    cacheMtime = currentMtime;
  }

  if (!existsSync(registryPath)) {
    return {
      registryVersion: 1,
      commands: {},
    };
  }

  try {
    const content = readFileSync(registryPath, "utf-8");
    const data = yaml.load(content) as BinRegistryData;

    if (!data || typeof data !== "object") {
      throw new Error("Invalid registry format");
    }

    data.commands = data.commands || {};
    data.registryVersion = data.registryVersion || 1;

    cachedRegistry = data;
    return data;
  } catch (error) {
    log.warn(`Failed to read bin registry: ${error}`);
    return {
      registryVersion: 1,
      commands: {},
    };
  }
}

export function writeRegistry(data: BinRegistryData): void {
  const registryPath = getRegistryPath();

  mkdirSync(dirname(registryPath), { recursive: true });

  const header =
    "# kly bin registry - Tracks globally registered commands\n" +
    "# This file is auto-generated and auto-updated\n\n";

  const yamlContent = yaml.dump(data, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: true,
  });

  writeFileSync(registryPath, header + yamlContent, "utf-8");

  // Update cache
  cachedRegistry = data;
  if (existsSync(registryPath)) {
    cacheMtime = statSync(registryPath).mtimeMs;
  }
}

export function getCommand(commandName: string): BinRegistryEntry | null {
  const registry = readRegistry();
  return registry.commands[commandName] || null;
}

export function addCommand(commandName: string, entry: BinRegistryEntry): void {
  const registry = readRegistry();
  registry.commands[commandName] = entry;
  writeRegistry(registry);
}

export function removeCommand(commandName: string): boolean {
  const registry = readRegistry();

  if (!registry.commands[commandName]) {
    return false;
  }

  delete registry.commands[commandName];
  writeRegistry(registry);
  return true;
}

export function updateLastUsed(commandName: string): void {
  const registry = readRegistry();

  if (registry.commands[commandName]) {
    registry.commands[commandName].lastUsed = new Date().toISOString();
    writeRegistry(registry);
  }
}

export function listCommands(): Array<
  BinRegistryEntry & { commandName: string }
> {
  const registry = readRegistry();
  return Object.entries(registry.commands).map(([name, entry]) => ({
    ...entry,
    commandName: name,
  }));
}
