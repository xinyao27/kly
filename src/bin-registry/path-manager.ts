import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { log } from "../ui";

export function getShellConfigFile(): string | null {
  const home = homedir();
  const shell = process.env.SHELL || "";

  if (shell.includes("zsh")) {
    return join(home, ".zshrc");
  }
  if (shell.includes("bash")) {
    const bashrc = join(home, ".bashrc");
    const profile = join(home, ".bash_profile");
    return existsSync(bashrc) ? bashrc : profile;
  }
  if (shell.includes("fish")) {
    return join(home, ".config", "fish", "config.fish");
  }

  return null;
}

export function isKlyBinInPath(): boolean {
  const path = process.env.PATH || "";
  const klyBin = join(homedir(), ".kly", "bin");
  return path.split(":").includes(klyBin);
}

export async function setupPath(): Promise<boolean> {
  if (isKlyBinInPath()) {
    log.success("~/.kly/bin is already in your PATH");
    return true;
  }

  const configFile = getShellConfigFile();

  if (!configFile) {
    log.warn("Could not detect shell configuration file");
    p.log.info("\nManually add this to your shell config:");
    p.log.message('  export PATH="$HOME/.kly/bin:$PATH"');
    return false;
  }

  p.log.info(`\nDetected shell config: ${configFile}`);

  const shouldAdd = await p.confirm({
    message: "Add ~/.kly/bin to PATH in your shell config?",
  });

  if (p.isCancel(shouldAdd) || !shouldAdd) {
    p.log.message("Cancelled");
    return false;
  }

  try {
    const shell = process.env.SHELL || "";
    let pathLine: string;

    if (shell.includes("fish")) {
      pathLine = "\n# Added by kly\nset -gx PATH $HOME/.kly/bin $PATH\n";
    } else {
      pathLine = '\n# Added by kly\nexport PATH="$HOME/.kly/bin:$PATH"\n';
    }

    // Check if already added (avoid duplicates)
    if (existsSync(configFile)) {
      const content = readFileSync(configFile, "utf-8");
      if (content.includes("# Added by kly")) {
        log.success("~/.kly/bin is already configured in your shell");
        return true;
      }
    }

    appendFileSync(configFile, pathLine, "utf-8");

    log.success(`Added to ${configFile}`);
    p.log.info("\nRestart your shell or run:");
    p.log.message(`  source ${configFile}`);

    return true;
  } catch (error) {
    log.warn(`Failed to update ${configFile}: ${error}`);
    return false;
  }
}

export function checkPathSetup(): void {
  if (!isKlyBinInPath()) {
    log.warn("~/.kly/bin is not in your PATH");
    p.log.message("Run 'kly install --setup-path' to configure automatically");
  }
}
