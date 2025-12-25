# Clai Architecture Design

> **Core Philosophy**: Define the universal software unit for the AI era.
> **Design Principle**: Write once, run everywhere (CLI / MCP / Skill).

---

## 1. The "Trinity" Architecture (三位一体)

Clai apps can simultaneously serve as:

1. **CLI Tool** - Direct human interaction via terminal
2. **MCP Tool** - AI agent capability (Claude Desktop, Claude Code)
3. **Composable Skill** - Building block for other apps

```
┌─────────────────────────────────────────────────────────────┐
│                      defineApp()                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  schema (Standard Schema)  │  permissions  │  run()     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
    ┌─────────┐          ┌─────────┐          ┌─────────┐
    │   CLI   │          │   MCP   │          │  Skill  │
    │  Human  │          │   AI    │          │ Compose │
    └─────────┘          └─────────┘          └─────────┘
```

---

## 2. Unified App Definition

### 2.1 Standard Schema Compatibility

Clai uses [Standard Schema](https://github.com/standard-schema/standard-schema) specification instead of binding to a specific validation library. This means you can use **any** Standard Schema compliant library:

- **Zod** - Most popular, great TypeScript inference
- **Valibot** - Smaller bundle size, modular
- **ArkType** - Fastest runtime validation
- **TypeBox** - JSON Schema compatible

```typescript
// With Zod
import { z } from "zod"
const schema = z.object({ city: z.string() })

// With Valibot
import * as v from "valibot"
const schema = v.object({ city: v.string() })

// With ArkType
import { type } from "arktype"
const schema = type({ city: "string" })

// All work with defineApp - framework reads Standard Schema interface
```

**Why Standard Schema?**
- Users choose their preferred validation library
- Smaller bundle when using lightweight libs like Valibot
- Future-proof: new schema libraries automatically compatible
- Ecosystem interoperability (works with tRPC, Hono, etc.)

### 2.2 Core API

```typescript
import { kit } from "@clai/kit"
import { z } from "zod" // or valibot, arktype, etc.

export default kit.defineApp({
  // --- Identity ---
  name: "weather-pro",
  version: "0.1.0",
  description: "Professional weather analysis tool",

  // --- Schema (auto-generates CLI args + MCP params + TUI forms) ---
  schema: z.object({
    city: z.string().describe("City name (supports multiple languages)"),
    forecast: z.boolean().default(false).describe("Include forecast"),
    days: z.number().min(1).max(14).default(7).describe("Forecast days"),
  }),

  // --- Permissions (iOS-style declarative) ---
  permissions: {
    net: ["api.openweathermap.org", "wttr.in"],
    fs: { read: ["~/.config/weather"] },
  },

  // --- Execution ---
  async run({ args, ctx }) {
    const data = await ctx.fetch(`https://wttr.in/${args.city}?format=j1`)

    // ctx.ui adapts to environment:
    // - CLI mode: renders TUI components
    // - MCP mode: converts to structured text
    ctx.ui.table(data.current_condition)

    return data // Return value becomes MCP tool result
  },

  // --- Optional: Natural language intent parsing ---
  async onInferredIntent(hint: string, ctx) {
    // Called when user provides fuzzy input instead of structured args
    // e.g., "明天北京冷不冷" → { city: "Beijing", forecast: true }
    return ctx.infer(hint, this.schema)
  },
})
```

### 2.2 Simplified UI Abstraction

Provide a minimal abstraction layer based on `@clack/prompts`:

```typescript
interface ClaiUI {
  // Output
  text(content: string): void
  code(content: string, lang?: string): void
  diff(before: string, after: string): void
  table(data: Record<string, any>[]): void

  // Input
  input(label: string): Promise<string>
  confirm(message: string): Promise<boolean>
  select<T>(options: SelectOptions<T>): Promise<T>
  multiSelect<T>(options: SelectOptions<T>): Promise<T[]>

  // Status
  spinner(message: string): SpinnerController
  progress(total: number): ProgressController
}
```

**Benefits**:
- LLM can easily generate correct code (small API surface)
- 5-minute learning curve for users
- Consistent cross-platform experience

---

## 3. Context-Aware Inference (推理权归属)

**Core Principle**: Whoever calls me, I use their brain.

```
┌─────────────────────────────────────────────────────────────┐
│                     clai run weather.ts                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Detect Runtime │
                    └─────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │   CLI Mode       │             │   MCP Mode       │
    │   (stdin/tty)    │             │   (stdio/json)   │
    └─────────────────┘             └─────────────────┘
              │                               │
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ Self-invoke LLM  │             │ No LLM call      │
    │ (needs API Key)  │             │ Claude already   │
    │                  │             │ parsed the args  │
    └─────────────────┘             └─────────────────┘
```

### 3.1 MCP Mode: Free Inference

When Claude Code calls your tool, **parameter parsing is already done inside Claude**. Your `description` and `schema` ARE the prompt.

```typescript
// MCP Tool Definition (auto-generated from defineApp)
{
  name: "weather-pro",
  description: `
    Professional weather analysis tool.

    Smart parameter parsing examples:
    - "Is it warm tomorrow?" → { city: "current", forecast: true }
    - "Will it rain in Beijing next week?" → { city: "Beijing", forecast: true, days: 7 }
  `,
  inputSchema: { /* from Zod schema */ }
}
```

**Key insight**: In MCP mode, `description` IS your prompt. Claude generates schema-compliant JSON directly. **Zero additional LLM calls needed.**

### 3.2 CLI Mode: Cascading Fallback

```typescript
const inferenceProviders = {
  // Level 1: MCP environment (free)
  mcp: () => process.env.CLAI_MCP_MODE === "true",

  // Level 2: Local Ollama (free, requires install)
  ollama: () => canConnectTo("http://localhost:11434"),

  // Level 3: User-configured API Key
  openai: () => process.env.OPENAI_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,

  // Level 4: Official cloud gateway (limited free tier)
  gateway: () => true, // always available as fallback
}

async function resolveInference(hint: string, schema: ZodSchema) {
  for (const [name, check] of Object.entries(inferenceProviders)) {
    if (await check()) {
      return useProvider(name, hint, schema)
    }
  }
}
```

### 3.3 User Experience Flow

```bash
# Scenario 1: Exact parameters, no LLM needed
$ clai run weather.ts --city Beijing
✓ Direct execution, no inference

# Scenario 2: Fuzzy intent, CLI mode
$ clai run weather.ts "Is Beijing cold tomorrow?"

# If Ollama is running:
⚡ Using local Ollama for intent parsing...
→ Parsed: { city: "Beijing", forecast: true, metric: "temperature" }

# If no local model and no API Key:
┌─────────────────────────────────────────────────┐
│  Need LLM to understand your intent:            │
│                                                  │
│  [1] Start Ollama (recommended, free locally)   │
│  [2] Enter OpenAI API Key                       │
│  [3] Use clai cloud (50 free/day)               │
│  [4] Enter parameters manually                  │
└─────────────────────────────────────────────────┘

# Scenario 3: Claude Code via MCP
# User: "Check if Beijing is cold tomorrow"
# Claude internal reasoning → calls weather-pro tool → args already JSON
# Your run() receives { city: "Beijing", forecast: true, ... }
```

### 3.4 Inference Context API

```typescript
interface InferContext {
  // Auto-select optimal inference source
  infer<T>(prompt: string, schema: z.ZodType<T>): Promise<T>

  // Explicit provider (advanced)
  infer<T>(prompt: string, schema: z.ZodType<T>, options: {
    provider?: "auto" | "ollama" | "openai" | "anthropic" | "gateway"
    fallback?: boolean
  }): Promise<T>

  // Current inference environment
  inferenceProvider: "mcp" | "ollama" | "openai" | "anthropic" | "gateway"

  // MCP-only: delegate reasoning back to Claude
  delegateReasoning(data: any, prompt: string): MCPDelegatedResult
}
```

### 3.5 Inference Cost Matrix

| Scenario | Source | Cost | Latency |
|----------|--------|------|---------|
| MCP Mode | Claude itself | Free | ~0ms |
| CLI + Ollama | Local model | Free | ~500ms |
| CLI + API Key | OpenAI/Anthropic | User pays | ~1s |
| CLI + Gateway | clai cloud | Limited free | ~1s |

---

## 4. Distribution (Go-Style)

### 4.1 URL as Identity

```bash
# GitHub direct
clai run github.com/user/repo

# Version pinning (like Go)
clai run github.com/user/repo@v1.2.3

# Short alias (like deno.land/x)
clai run x/npm-updater

# Local development
clai run ./my-tool.ts
```

### 4.2 Integrity Verification (clai.sum)

Using Subresource Integrity format:

```
github.com/user/repo@v1.0.0 sha384-oqVuAfXRKap7fdgc...
github.com/user/repo@v1.1.0 sha384-Kx8Qp2mN5vRtYw...
```

### 4.3 Vanity URLs

```
jack.clai.run/weather → 302 → github.com/jack/clai-tools/weather.ts
```

---

## 5. Permission System (iOS-Style)

### 5.1 Tiered Permissions

```typescript
permissions: {
  // Level 1: Harmless, silent allow
  fs: { read: ["./config.json"] },

  // Level 2: Sensitive, ask on first use
  net: ["api.openai.com"],

  // Level 3: Dangerous, ask every time
  shell: {
    allow: ["git", "npm"],
    deny: ["rm -rf", "sudo"],  // permanent blocklist
  }
}
```

### 5.2 Runtime Popup (TUI)

```
┌─────────────────────────────────────────────────────────────┐
│  Script 'npm-updater' wants to run shell command: npm       │
│                                                              │
│  [Allow Once]  [Always Allow]  [Deny]  [View Source]        │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Advanced Features

### 6.1 Prompts as First-Class Citizens

```typescript
// prompts/code-review.ts
export const codeReviewPrompt = definePrompt({
  name: "code-review",
  version: "1.0.0",
  template: `You are a code review expert...`,
  variables: z.object({
    code: z.string(),
    language: z.string(),
  }),
})

// Usage in app
import { codeReviewPrompt } from "clai.run/prompts/code-review"
await ctx.infer(codeReviewPrompt, { code, language: "typescript" })
```

### 6.2 Composable Apps

```typescript
import npmUpdater from "github.com/user/npm-updater"
import changelog from "github.com/user/changelog-gen"

export default kit.defineApp({
  name: "release-helper",

  async run({ ctx }) {
    await ctx.run(npmUpdater, { global: false })
    await ctx.run(changelog, { since: "v1.0.0" })
  }
})
```

### 6.3 Inference Delegation (MCP Mode)

```typescript
async run({ args, ctx }) {
  const weatherData = await fetchWeather(args.city)

  if (args.query && ctx.mode === "mcp") {
    // Return special marker for Claude to continue reasoning
    return {
      data: weatherData,
      _clai_meta: {
        needsReasoning: true,
        reasoningPrompt: `Based on this weather data, answer: "${args.query}"`,
      }
    }
  }

  ctx.ui.table(weatherData)
}
```

---

## 7. Technical Stack

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

## 8. Risks & Mitigations

### 8.1 Bun Compatibility

**Risk**: Some npm packages may have Bun compatibility issues.

**Mitigation**: Keep Node.js fallback path.

### 8.2 Security Sandbox

**Risk**: Monkey-patching `fetch` can be bypassed via dynamic imports.

**Mitigation**:
- Short-term: Best-effort interception
- Long-term: WASM sandbox or isolated process

---

## 9. MVP Sprint Plan

| Days | Focus | Deliverable |
|------|-------|-------------|
| 1-2 | Core | `@clai/kit` `defineApp` + Zod schema |
| 3-4 | UI Layer | @clack/prompts wrapper (`ctx.ui`) |
| 5-6 | Runtime | `clai run ./local.ts` + basic permission intercept |
| 7-8 | Network | GitHub URL parser + basic cache |
| 9-10 | AI | `ctx.infer` + streaming output |
| 11-14 | Launch | Demo apps + docs + npm publish |

---

> This is a battle from **Protocol** to **Platform**.
