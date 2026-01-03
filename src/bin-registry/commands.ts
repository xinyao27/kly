import { resolve } from "node:path";
import { isRemoteRef } from "../remote";
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
  // Link is for local development - like npm link
  const targetPath = args[0] || process.cwd();
  const absolutePath = resolve(process.cwd(), targetPath);

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
