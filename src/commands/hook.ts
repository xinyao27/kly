import fs from "node:fs";
import path from "node:path";

import { error, info, warn } from "./output";

const HOOK_BEGIN = "# BEGIN kly";
const HOOK_END = "# END kly";
const HOOK_CONTENT = `${HOOK_BEGIN}
kly build --quiet 2>/dev/null || true
${HOOK_END}`;

export function runHook(root: string, action: string): void {
  if (action !== "install" && action !== "uninstall") {
    error("Invalid action.", "kly hook install\n  kly hook uninstall");
  }

  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) {
    error("Not a git repository.");
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
      info("kly hook already installed (no-op)");
      return;
    }
    // Append to existing hook
    fs.appendFileSync(hookPath, `\n${HOOK_CONTENT}\n`);
  } else {
    fs.writeFileSync(hookPath, `#!/bin/sh\n${HOOK_CONTENT}\n`, { mode: 0o755 });
  }

  info("installed post-commit hook");
}

function uninstallHook(hookPath: string): void {
  if (!fs.existsSync(hookPath)) {
    warn("no post-commit hook found (no-op)");
    return;
  }

  const content = fs.readFileSync(hookPath, "utf-8");
  if (!content.includes(HOOK_BEGIN)) {
    warn("kly hook not found in post-commit (no-op)");
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

  info("uninstalled post-commit hook");
}
