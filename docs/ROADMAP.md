# Clai (Command Line AI) Project Roadmap

> **Mission:** Redefining the terminal experience where CLI meets AI.
> **Core Identity:** Visual ambiguity logo (cli <-> ai) | Domain target: `clai.run`

---

## Phase 1: The Protocol (SDK & Definition)

**Goal:** Define the standard contract for "micro-apps". Everything starts with `kit`.

### 1.1 Build `@clai/kit` SDK

* **Architecture Core:** Based on **Bun** + **Zod** + **TypeScript**.
* **`defineApp` Interface:**
  * **Schema First:** Mandatory use of Zod for input parameter definitions (auto-generates TUI and CLI argument parsing).
  * **Metadata:** Includes name, description, version.
  * **Lifecycle:** `run({ args, ctx })` standard execution entry point.

* **AI Capability Integration (`ctx.infer`):**
  * Built-in prompt template injection interface.
  * Support for streaming output for instant feedback.

* **MCP Compatibility:**
  * SDK natively supports export to **Model Context Protocol (MCP)** format, ensuring Claude Desktop can directly "learn" any Clai tool.

### 1.2 Declarative Permission System (The Contract)

* **Metadata Standard:**
  * Define `clai.permissions` field in `package.json` (or single-file header comment `// @clai-perm`).
* **Fine-grained Control:**
  * `fs.read`: whitelist paths (e.g., `["./src", "~/Downloads"]`)
  * `net`: whitelist domains (e.g., `["api.openai.com"]`)
  * `shell`: whitelist commands (e.g., `["git", "npm"]`)

---

## Phase 2: The Runtime (Runner & Security)

**Goal:** Implement `npx clai run`, allowing code to run in a controlled, secure, and elegant environment.

### 2.1 Runtime Security Sandbox (The Guardian)

* **Bun Permission Completion:**
  * Since Bun lacks `--allow-net`, intercept `globalThis.fetch` and `Bun.file` via **Monkey Patch / Preload Script** techniques.
  * **Runtime Interception:** Before each IO operation, compare against the permission whitelist defined in Phase 1.

* **iOS-Style Popup (TUI):**
  * On first run of unauthorized scripts, display interactive TUI:
    * `"Script 'Cleaner' wants to access your Desktop. [Allow Once] [Always Allow]"`

### 2.2 Smart TUI Generator

* **No-Code UI:** If user doesn't pass arguments, Runner automatically renders interactive forms (Input, Select, Confirm) based on Zod Schema.
* **Spinners & Progress:** Built-in elegant loading animations to mask LLM inference latency.

---

## Phase 3: The Distribution (Go-Style Network)

**Goal:** Decentralized distribution. Solve "publishing difficulty" and "version fragmentation" problems.

### 3.1 URL as Identity

* **Direct GitHub Connection:** Support `clai run github.com/user/repo`.
* **Integrity Verification:**
  * Introduce **`clai.sum`** (similar to `go.sum`).
  * Hash signature of code content + `bun.lock` + permission declarations to prevent code tampering.

### 3.2 Subdomain Mapping System (Vanity URLs)

* **Service Architecture:** Establish `clai.run` domain service.
* **Registration Process:** User submits PR to `clai-registry` repo -> auto-deploy DNS/Redirect rules.
* **Result:** `jack.clai.run/tool` -> 302 Redirect -> `github.com/jack/tools/index.ts`.

### 3.3 Acceleration Proxy (The Proxy)

* **Tech Stack:** Cloudflare Workers.
* **Features:**
  * Cache GitHub source code (solve slow access in China).
  * Pre-compute Schema and Metadata (accelerate `clai list` display).

---

## Phase 4: The Studio (Web Creation & Preview)

**Goal:** Dimensional reduction strike. Let non-programmers complete the full dev-to-publish flow in browser.

### 4.1 WebContainer-Based IDE

* **Tech Selection:** Use StackBlitz's **WebContainer API** to run real Node.js/Bun environment in browser.
* **Main Features:**
  * **Dual-Screen Editor:** Left side Zod form designer / Prompt editing, right side real-time code preview.
  * **Real Terminal Simulation:** Integrate `xterm.js`, TUI effects in browser identical to local.
  * **Network Proxy Bridge:** Solve browser CORS issues, let Web Clai access external APIs.

### 4.2 One-Click Publish Loop

* **OAuth Integration:** User clicks "Publish", system auto-creates Gist or Repo in user's GitHub.
* **Auto Domain Claim:** Auto-submit subdomain registration PR, accessible via `clai run xxx` in minutes.

---

## Phase 5: The Evolution (Self-Healing)

**Goal:** Build technical moat, let the ecosystem self-maintain.

### 5.1 Runtime Self-Healing (Runtime Fix)

* **Error Interceptor:** Capture all `stderr` and uncaught exceptions.
* **AI Diagnosis:** Send error stack + source code + environment info to LLM.
* **Hot Patch:** LLM generates temporary fix code, asks user whether to apply and retry.

### 5.2 Automated Contribution (Auto-PR)

* **Closed-Loop Feedback:** If Hot Patch runs successfully, Runner prompts user:
  * `"Fix worked! Would you like to send a PR to the author?"`

* **Background Execution:** Auto Fork original repo -> Submit fix -> Create Pull Request (e.g., `fix: runtime error handling by Clai AI`).

---

## Phase 6: Sustainability (Business Model)

**Goal:** Ensure project sustainable development, not just passion-driven.

### 6.1 Commercial Tiers

* **Community (Free):** Open source SDK, public Proxy, `.clai.run` subdomain.
* **Pro (Developer):**
  * Private repository support (OAuth Token management).
  * Cloud Secrets injection (configure API Keys on Web, securely distribute to local).

* **Enterprise (B2B):**
  * **Private Registry:** Deploy `proxy.clai` on enterprise intranet, audit and control which scripts employees can run.
  * **RBAC Permission Dashboard:** Unified management of team internal tool permission policies.

### 6.2 Trust Rating System

* **Verified Author:** GitHub verified + long-term no malicious behavior.
* **Audited Script:** Scripts scanned by AI static analysis with no backdoors, marked with checkmark.

---

## Execution Sprint (MVP: The First 2 Weeks)

| Days | Focus | Deliverable |
|------|-------|-------------|
| 1-3 | Kernel | Complete `packages/kit`. Implement `defineApp` and mock `PermissionGuard`. |
| 4-6 | Runner | Complete `packages/cli`. Implement local `.ts` file execution and basic TUI rendering. |
| 7-9 | Network | Implement simplest GitHub URL parser/downloader. |
| 10 | Branding | Register domain `clai.run` (or alternatives `hop.sh`, `oxe.run`), design "visual pun" logo. |
| 11-14 | Launch | Write README, record Demo, publish v0.1.0 to npm. |

---

## Technical Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Type Safety | TypeScript + Zod |
| TUI | Ink / Clack |
| Build | tsdown |
| Distribution | GitHub-first + Cloudflare Workers |
| Web IDE | WebContainer API + xterm.js |
| AI Integration | MCP Protocol Compatible |

---

> This is a battle from **Protocol** to **Platform**.
