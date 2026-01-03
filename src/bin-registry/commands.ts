import { resolve } from "node:path";
import { isRemoteRef, runRemote } from "../remote";
import { checkCache } from "../remote/cache";
import { getRepoCachePath, parseRemoteRef } from "../remote/parser";
import { ExitError } from "../shared/errors";
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
    throw new ExitError(
      "Missing target\nUsage: kly install <file|user/repo[@ref]>\n   or: kly install --setup-path",
    );
  }

  if (target === "--setup-path") {
    await setupPath();
    return;
  }

  // Install is essentially "run + force register"
  if (isRemoteRef(target)) {
    await runRemote(target, {
      args: args.slice(1),
      skipRegister: false, // Ensure registration happens
    });
  } else {
    // For local projects, just link them directly
    const absolutePath = resolve(process.cwd(), target);
    const detection = detectBins(absolutePath);

    if (!detection.hasBin) {
      log.warn("No bin field found in package.json");
      log.message("This project cannot be installed as a command");
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
    throw new ExitError(
      "Missing command name\nUsage: kly uninstall <command-name>",
    );
  }

  await unregisterCommand(commandName, { skipConfirm: false });
}

export async function linkCommand(args: string[]): Promise<void> {
  const target = args[0] || process.cwd();

  // Check if it's a remote reference
  if (isRemoteRef(target)) {
    const ref = parseRemoteRef(target);
    if (!ref) {
      throw new ExitError(`Invalid remote reference: ${target}`);
    }

    const repoPath = getRepoCachePath(ref);
    const cacheResult = checkCache(ref);

    if (!cacheResult.valid) {
      throw new ExitError(
        `Remote package not cached. Run 'kly run ${target}' first to download it.`,
      );
    }

    const detection = detectBins(repoPath);

    if (!detection.hasBin) {
      throw new ExitError("No bin field found in package.json");
    }

    log.step(`Linking ${detection.projectName}...`);

    await autoRegisterBins(repoPath, {
      type: "remote",
      remoteRef: target,
      force: true,
      skipConfirm: true,
    });

    log.success("Linked successfully!");
  } else {
    // Link is for local development - like npm link
    const absolutePath = resolve(process.cwd(), target);

    const detection = detectBins(absolutePath);

    if (!detection.hasBin) {
      throw new ExitError("No bin field found in package.json");
    }

    log.step(`Linking ${detection.projectName}...`);

    await autoRegisterBins(absolutePath, {
      type: "local",
      force: true,
      skipConfirm: true, // Link is explicit, no need to ask
    });

    log.success("Linked successfully!");
  }
}

export async function listCommand(): Promise<void> {
  const commands = listCommands();

  if (commands.length === 0) {
    log.message("No commands registered");
    log.info("\nRun 'kly install <target>' to register commands");
    return;
  }

  log.info(`\nRegistered commands (${commands.length}):\n`);

  for (const cmd of commands) {
    const source = cmd.type === "remote" ? cmd.remoteRef : cmd.localPath;

    log.message(
      `  ${cmd.commandName.padEnd(20)} ${cmd.projectName}@${cmd.projectVersion}`,
    );
    log.message(`  ${" ".repeat(20)} ${source}`);
    log.message("");
  }

  checkPathSetup();
}
