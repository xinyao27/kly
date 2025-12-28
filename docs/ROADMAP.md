# Kly (Command Line AI) Project Roadmap

> **Mission:** Redefining the terminal experience where CLI meets AI.
> **Core Identity:** Visual ambiguity logo (cli <-> ai) | Domain target: `kly.sh`

---

## Phase 1: The Protocol (SDK & Definition)

**Goal:** Define the standard contract for "micro-apps" with Tool + App separation pattern.

### 1.1 Build `@kly/kit` SDK

* **Architecture Core:** Based on **Bun** + **Standard Schema** + **TypeScript**.
* **Two-Layer API Design:**
  * **`tool()`** - Define individual capabilities with inputSchema and execute function.
  * **`defineApp()`** - Compose multiple tools into a distributable app.

* **Tool Definition Interface:**
  ```typescript
  tool({
    name: "greet",
    description: "Say hello to someone",
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => `Hello, ${name}!`,
  })
  ```

* **App Composition Interface:**
  ```typescript
  defineApp({
    name: "hello",
    version: "0.1.0",
    description: "Hello world CLI",
    tools: [greetTool, farewellTool],
    instructions: "AI routing hints for Skill mode",
  })
  ```

* **Standard Schema Compatibility:**
  * Support Zod, Valibot, ArkType, TypeBox - any Standard Schema compliant library.
  * Auto-generates TUI forms and CLI argument parsing from schema.

* **MCP Compatibility:**
  * SDK natively exports `tools[]` array as MCP Tool list.
  * Claude Desktop/Claude Code can directly invoke any Kly tool.

---

## Phase 2: The Runtime

**Goal:** Implement `kly run` with context-aware execution modes.

### 2.1 Runtime Mode Detection

* **CLI Mode (interactive):**
  * Without args: List all available tools for user selection.
  * With tool name: Auto-generate TUI form from inputSchema.
  * With full args: Direct execution.

* **MCP Mode (stdio/json):**
  * Expose `tools[]` array directly as MCP Tool list.
  * AI handles parameter parsing - zero additional LLM calls.

* **Skill Mode (composed):**
  * Use `instructions` field for AI routing hints.
  * Composable with other apps via `ctx.run()`.

### 2.2 Smart TUI Generator

* **No-Code UI:** Auto-render interactive forms based on inputSchema.
* **Context-Aware Rendering:**
  * CLI mode: Full TUI components via @clack/prompts.
  * MCP mode: Convert to structured text output.
* **Built-in Status Components:** Spinners, progress bars, tables.

---

## Phase 3: AI Integration ✅

**Goal:** Seamless LLM integration with cascading provider fallback.

**Status:** Partially complete (Hybrid Parameter Mode implemented)

### 3.1 LLM Configuration Management ⏸️

* **Config Commands:** (Planned)
  ```bash
  kly config set provider openai
  kly config set openai.api_key sk-xxxx
  kly config set provider ollama  # Local models
  kly config set provider deepseek
  ```

* **Current Implementation:** Environment variable detection
  * `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`
  * `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`

* **Supported Providers:**
  * ✅ OpenAI
  * ✅ Anthropic
  * ⏸️ DeepSeek (can use via custom endpoints)
  * ⏸️ Ollama (planned)

### 3.2 Cascading Inference Providers ⏸️

* **Priority Order:** (Planned)
  1. MCP environment (free - Claude handles it)
  2. Local Ollama (free, requires install)
  3. User-configured API Key (user pays)
  4. Official cloud gateway (limited free tier)

* **Current Implementation:** Environment variable priority
  1. `OPENAI_API_KEY` → Uses OpenAI
  2. `ANTHROPIC_API_KEY` → Uses Anthropic

### 3.3 Hybrid Parameter Mode ✅

* **Execution Modes:**
  ```bash
  # Fully specified - no LLM needed
  kly run weather.ts --city Beijing --days 7

  # Fuzzy intent - uses configured LLM ✅
  kly run weather.ts "Is Beijing cold tomorrow?"

  # Mixed mode - AI fills in missing params ✅
  kly run weather.ts --city Beijing "should I bring umbrella?"
  ```

* **Features:**
  * ✅ Natural language detection
  * ✅ Parameter extraction with LLM
  * ✅ Smart tool selection for multi-tool apps
  * ✅ Result caching (up to 100 entries)
  * ✅ Hybrid CLI flags + natural language
  * ✅ Spinner feedback during LLM calls

---

## Phase 4: The Distribution (Go-Style Network)

**Goal:** Decentralized distribution with auto-alias registration.

### 4.1 URL as Identity

* **Supported Formats:**
  ```bash
  kly run github.com/user/repo          # GitHub direct
  kly run github.com/user/repo@v1.2.3   # Version pinning
  kly run x/npm-updater                 # Short alias
  kly run jack.kly.sh/hello            # Custom domain
  kly run ./my-tool.ts                  # Local development
  ```

### 4.2 Auto Alias Registration

* **First Run Flow:**
  ```bash
  npx kly run jack.kly.sh/hello  # Downloads and registers
  hello greet --name "World"       # Works directly after
  ```

### 4.3 Integrity Verification (kly.sum)

* **Security:**
  * Hash signature of code content + bun.lock.
  * Prevent code tampering via `kly.sum` file.

### 4.4 Subdomain Mapping System

* **Service Architecture:** Establish `kly.sh` domain service.
* **Registration:** User submits PR to registry repo -> auto-deploy.
* **Result:** `jack.kly.sh/tool` -> 302 -> `github.com/jack/tools/index.ts`

### 4.5 Acceleration Proxy

* **Tech Stack:** Cloudflare Workers.
* **Features:**
  * Cache GitHub source code.
  * Pre-compute Schema and Metadata.

---

## Phase 5: The Studio (Web Creation & Preview)

**Goal:** Let non-programmers complete the full dev-to-publish flow in browser.

### 5.1 No-Code TUI Previewer

* **Three-Panel Layout:**
  ```
  ┌─────────────────┬─────────────────┬─────────────────┐
  │  Schema Builder │   Terminal      │   AI Logic      │
  │  (visual)       │   (xterm.js)    │   (generate)    │
  ├─────────────────┼─────────────────┼─────────────────┤
  │  Visual schema  │  Real-time      │  Generate       │
  │  editor for     │  terminal       │  execute()      │
  │  inputSchema    │  simulation     │  from AI        │
  └─────────────────┴─────────────────┴─────────────────┘
  ```

### 5.2 WebContainer-Based IDE

* **Tech Selection:** StackBlitz's **WebContainer API** for browser-native Bun.
* **Features:**
  * Real terminal simulation via xterm.js.
  * Network proxy bridge for external API access.
  * Full isolation for security.

### 5.3 One-Click Publish Loop

* **OAuth Integration:** Auto-create Gist or Repo in user's GitHub.
* **Auto Domain Klym:** Auto-submit subdomain registration PR.

---

## Phase 6: The Evolution (Self-Healing)

**Goal:** Build technical moat with self-maintaining ecosystem.

### 6.1 Runtime Self-Healing

* **Error Interceptor:** Capture all stderr and uncaught exceptions.
* **AI Diagnosis:** Send error stack + source code + environment to LLM.
* **Hot Patch:** LLM generates temporary fix, asks user whether to apply.

### 6.2 Automated Contribution (Auto-PR)

* **Closed-Loop Feedback:**
  ```
  "Fix worked! Would you like to send a PR to the author?"
  ```
* **Background Execution:** Auto Fork -> Submit fix -> Create Pull Request.

---

## Phase 7: Sustainability (Business Model)

**Goal:** Ensure project sustainable development.

### 7.1 Commercial Tiers

* **Community (Free):**
  * Open source SDK
  * Public Proxy
  * `.kly.sh` subdomain

* **Pro (Developer):**
  * Private repository support
  * Cloud Secrets injection

* **Enterprise (B2B):**
  * Private Registry deployment
  * RBAC Permission Dashboard

### 7.2 Trust Rating System

* **Verified Author:** GitHub verified + long-term no malicious behavior.
* **Audited Script:** AI static analysis with no backdoors.

---

## Execution Sprint (MVP)

| Days | Focus | Deliverable |
|------|-------|-------------|
| 1-2 | Core API | `tool()` + `defineApp()` with Standard Schema support |
| 3-4 | UI Layer | @clack/prompts wrapper (`ctx.ui`) |
| 5-6 | Runtime | `kly run ./local.ts` |
| 7-8 | Network | GitHub URL parser + basic cache |
| 9-10 | AI | `ctx.infer` + provider configuration + streaming |
| 11-12 | MCP | MCP adapter for tools[] exposure |
| 13-14 | Launch | Demo apps + docs + npm publish |

---

## Technical Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Type Safety | TypeScript + Standard Schema (Zod/Valibot/ArkType) |
| TUI | @clack/prompts |
| Build | tsdown |
| Distribution | GitHub-first + Cloudflare Workers |
| Web IDE | WebContainer API + xterm.js |
| AI Integration | MCP Protocol Compatible |

---

## Architecture Positioning

kly is the **"Terminal OS"** microkernel:

| Component | Role |
|-----------|------|
| Kernel | Bun (extreme speed) |
| Interface | Zod + tool() / defineApp() (type-safe) |
| Brain | LLM (fuzzy intent handling) |
| Peripherals | MCP / Skills (ecosystem integration) |
| Address | kly.sh (decentralized distribution) |

---

> This is a battle from **Protocol** to **Platform**.
