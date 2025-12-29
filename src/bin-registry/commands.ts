import { resolve } from "node:path";
import * as p from "@clack/prompts";
import { isRemoteRef } from "../remote";
import { log } from "../ui";
import {
  autoRegisterBins,
  checkPathSetup,
  detectBins,
  listCommands,
  setupPath,
  unregisterCommand,
} from ".";

export async function installCommand(args: string[]): Promise<void> {
  const target = args[0];

  if (!target) {
    p.log.error("Missing target");
    p.log.message("Usage: kly install <file|user/repo[@ref]>");
    p.log.message("   or: kly install --setup-path");
    process.exit(1);
  }

  if (target === "--setup-path") {
    await setupPath();
    return;
  }

  // Install is essentially "run + force register"
  if (isRemoteRef(target)) {
    const { runRemote } = await import("../remote");
    await runRemote(target, {
      args: args.slice(1),
      skipRegister: false, // Ensure registration happens
    });
  } else {
    // For local projects, just link them directly
    const absolutePath = resolve(process.cwd(), target);
    const detection = detectBins(absolutePath);

    if (!detection.hasBin) {
      p.log.warn("No bin field found in package.json");
      p.log.message("This project cannot be installed as a command");
      return;
    }

    log.step(`Installing ${detection.projectName}...`);

    await autoRegisterBins(absolutePath, {
      type: "local",
      force: true,
      skipConfirm: false, // Ask user for confirmation
    });

    log.success("Installed successfully!");
  }
}

export async function uninstallCommand(args: string[]): Promise<void> {
  const commandName = args[0];

  if (!commandName) {
    p.log.error("Missing command name");
    p.log.message("Usage: kly uninstall <command-name>");
    process.exit(1);
  }

  await unregisterCommand(commandName, { skipConfirm: false });
}

export async function linkCommand(args: string[]): Promise<void> {
  // Link is for local development - like npm link
  const targetPath = args[0] || process.cwd();
  const absolutePath = resolve(process.cwd(), targetPath);

  const detection = detectBins(absolutePath);

  if (!detection.hasBin) {
    p.log.error("No bin field found in package.json");
    process.exit(1);
  }

  log.step(`Linking ${detection.projectName}...`);

  await autoRegisterBins(absolutePath, {
    type: "local",
    force: true,
    skipConfirm: true, // Link is explicit, no need to ask
  });

  log.success("Linked successfully!");
}

export async function listCommand(): Promise<void> {
  const commands = listCommands();

  if (commands.length === 0) {
    p.log.message("No commands registered");
    p.log.info("\nRun 'kly install <target>' to register commands");
    return;
  }

  p.log.info(`\nRegistered commands (${commands.length}):\n`);

  for (const cmd of commands) {
    const source = cmd.type === "remote" ? cmd.remoteRef : cmd.localPath;

    p.log.message(
      `  ${cmd.commandName.padEnd(20)} ${cmd.projectName}@${cmd.projectVersion}`,
    );
    p.log.message(`  ${" ".repeat(20)} ${source}`);
    p.log.message("");
  }

  checkPathSetup();
}
