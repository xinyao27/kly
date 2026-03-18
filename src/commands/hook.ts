import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";

const HOOK_BEGIN = "# BEGIN kly";
const HOOK_END = "# END kly";
const HOOK_CONTENT = `${HOOK_BEGIN}
kly build --quiet 2>/dev/null || true
${HOOK_END}`;

export function runHook(root: string, action: string): void {
  if (action !== "install" && action !== "uninstall") {
    p.log.error('Usage: kly hook <install|uninstall>');
    process.exit(1);
  }

  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) {
    p.log.error("Not a git repository.");
    process.exit(1);
  }

  const hooksDir = path.join(gitDir, "hooks");
  const hookPath = path.join(hooksDir, "post-commit");

  if (action === "install") {
    installHook(hooksDir, hookPath);
  } else {
    uninstallHook(hookPath);
  }
}

function installHook(hooksDir: string, hookPath: string): void {
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  if (fs.existsSync(hookPath)) {
    const content = fs.readFileSync(hookPath, "utf-8");
    if (content.includes(HOOK_BEGIN)) {
      p.log.warn("kly hook already installed.");
      return;
    }
    // Append to existing hook
    fs.appendFileSync(hookPath, `\n${HOOK_CONTENT}\n`);
  } else {
    fs.writeFileSync(hookPath, `#!/bin/sh\n${HOOK_CONTENT}\n`, { mode: 0o755 });
  }

  p.log.success("Installed post-commit hook.");
}

function uninstallHook(hookPath: string): void {
  if (!fs.existsSync(hookPath)) {
    p.log.warn("No post-commit hook found.");
    return;
  }

  const content = fs.readFileSync(hookPath, "utf-8");
  if (!content.includes(HOOK_BEGIN)) {
    p.log.warn("kly hook not found in post-commit.");
    return;
  }

  // Remove the kly block
  const regex = new RegExp(`\\n?${HOOK_BEGIN}[\\s\\S]*?${HOOK_END}\\n?`, "g");
  const updated = content.replace(regex, "\n").trim();

  if (updated === "#!/bin/sh" || updated === "") {
    fs.unlinkSync(hookPath);
  } else {
    fs.writeFileSync(hookPath, updated + "\n", { mode: 0o755 });
  }

  p.log.success("Uninstalled post-commit hook.");
}
