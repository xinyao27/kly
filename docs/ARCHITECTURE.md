# Kly Architecture Design

> **Core Philosophy**: Define the universal software unit for the AI era.
> **Design Principle**: Write once, run everywhere (CLI / MCP / Skill).

---

## 1. The "Trinity" Architecture

Kly apps can simultaneously serve as:

1. **CLI Tool** - Direct human interaction via terminal
2. **MCP Tool** - AI agent capability (Claude Desktop, Claude Code)
3. **Composable Skill** - Building block for other apps

```
┌─────────────────────────────────────────────────────────────┐
│                      defineApp()                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  tools[]  │  instructions                                 ││
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

## 2. Core API Design

### 2.1 Tool + App Separation Pattern

Kly uses a two-layer architecture: **tool()** for individual capabilities, **defineApp()** for composition.

```typescript
import { tool, defineApp } from "@kly/kit"
import { z } from "zod" // or valibot, arktype, etc.

// Define individual tools
const greetTool = tool({
  name: "greet",
  description: "Say hello to someone",
  inputSchema: z.object({
    name: z.string().describe("Name to greet"),
    excited: z.boolean().default(false).describe("Add exclamation mark"),
  }),
  execute: async ({ name, excited }) => {
    const mark = excited ? "!" : "."
    return `Hello, ${name}${mark}`
  },
})

const farewellTool = tool({
  name: "farewell",
  description: "Say goodbye to someone",
  inputSchema: z.object({
    name: z.string().describe("Name to say goodbye to"),
  }),
  execute: async ({ name }) => {
    return `Goodbye, ${name}!`
  },
})

// Compose tools into an App
export default defineApp({
  name: "hello",
  version: "0.1.0",
  description: "Hello world CLI with greeting tools",
  tools: [greetTool, farewellTool],

  // Optional: AI instructions for Skill mode
  instructions: "When user expresses greeting intent, prefer the greet tool",
})
```

### 2.2 Standard Schema Compatibility

Kly uses [Standard Schema](https://github.com/standard-schema/standard-schema) specification instead of binding to a specific validation library:

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
```

### 2.3 Runtime Mode Behavior

```
┌─────────────────────────────────────────────────────────────┐
│                     kly run hello.ts                        │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────────┐
                    │  Detect Runtime │
                    └─────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   CLI Mode       │  │   MCP Mode       │  │  Skill Mode     │
│   (interactive)  │  │   (stdio/json)   │  │   (composed)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ List tools or    │  │ Expose tools[]   │  │ Use instructions│
│ auto-gen TUI     │  │ as MCP Tool list │  │ for AI routing  │
│ from schema      │  │ for AI to call   │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**CLI Mode:**

- Without args: List all available tools for user selection
- With tool name: Auto-generate TUI form from inputSchema
- With full args: Direct execution

**MCP Mode:**

- Expose `tools[]` array directly as MCP Tool list
- AI (Claude) handles parameter parsing - zero additional LLM calls

**Skill Mode:**

- Use `instructions` field for AI routing hints
- Composable with other apps via `ctx.run()`

---

## 3. AI Integration

### 3.1 LLM Configuration Management

```bash
# Set provider and API keys
kly config set provider openai
kly config set openai.api_key sk-xxxx

# Use local models
kly config set provider ollama

# Use DeepSeek
kly config set provider deepseek
kly config set deepseek.api_key xxx
```

### 3.2 Cascading Inference Providers

```typescript
const inferenceProviders = {
  // Level 1: MCP environment (free)
  mcp: () => process.env.KLY_MCP_MODE === "true",

  // Level 2: Local Ollama (free, requires install)
  ollama: () => canConnectTo("http://localhost:11434"),

  // Level 3: User-configured API Key
  openai: () => process.env.OPENAI_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,
  deepseek: () => process.env.DEEPSEEK_API_KEY,

  // Level 4: Official cloud gateway (limited free tier)
  gateway: () => true, // always available as fallback
}
```

### 3.3 Hybrid Parameter Mode

Support "half fixed + half AI-generated" parameters:

```bash
# Fully specified - no LLM needed
kly run weather.ts --city Beijing --days 7

# Fuzzy intent - uses configured LLM
kly run weather.ts "Is Beijing cold tomorrow?"

# Mixed mode - AI fills in missing params
kly run weather.ts --city Beijing "should I bring umbrella?"
```

### 3.4 Inference Cost Matrix

| Scenario      | Source                    | Cost         | Latency |
| ------------- | ------------------------- | ------------ | ------- |
| MCP Mode      | Claude itself             | Free         | ~0ms    |
| CLI + Ollama  | Local model               | Free         | ~500ms  |
| CLI + API Key | OpenAI/Anthropic/DeepSeek | User pays    | ~1s     |
| CLI + Gateway | kly cloud                 | Limited free | ~1s     |

---

## 4. Distribution (Go-Style)

### 4.1 URL as Identity

```bash
# GitHub direct
kly run github.com/user/repo

# Version pinning (like Go)
kly run github.com/user/repo@v1.2.3

# Short alias (like deno.land/x)
kly run x/npm-updater

# Custom domain
kly run jack.kly.sh/hello

# Local development
kly run ./my-tool.ts
```

### 4.2 Auto Alias Registration

```bash
# First run
npx kly run jack.kly.sh/hello  # Downloads and registers

# Subsequent runs - direct command
hello greet --name "World"       # Works directly
```

### 4.3 Integrity Verification (kly.sum)

Using Subresource Integrity format:

```
github.com/user/repo@v1.0.0 sha384-oqVuAfXRKap7fdgc...
github.com/user/repo@v1.1.0 sha384-Kx8Qp2mN5vRtYw...
```

### 4.4 Vanity URLs

```
jack.kly.sh/weather → 302 → github.com/jack/kly-tools/weather.ts
```

---

## 5. UI Abstraction

### 5.1 Simplified UI API

Based on `@clack/prompts`:

```typescript
interface KlyUI {
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

### 5.2 Context-Aware Rendering

```typescript
const processTool = tool({
  name: "process",
  inputSchema: z.object({ file: z.string() }),
  execute: async ({ file }, ctx) => {
    // ctx.ui adapts to environment:
    // - CLI mode: renders TUI components
    // - MCP mode: converts to structured text
    ctx.ui.spinner("Processing...")
    const result = await processFile(file)
    ctx.ui.table(result)
    return result
  },
})
```

---

## 6. Web Development Experience

### 6.1 No-Code TUI Previewer

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Schema Builder │   Terminal      │   AI Logic      │
│  (visual)       │   (xterm.js)    │   (generate)    │
├─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │
│  ┌───────────┐  │  $ hello greet  │  Generate       │
│  │ name      │  │  > Enter name:  │  execute()      │
│  │ [string]  │  │  World          │  logic from     │
│  ├───────────┤  │  Hello, World!  │  description    │
│  │ excited   │  │                 │                 │
│  │ [boolean] │  │                 │                 │
│  └───────────┘  │                 │                 │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### 6.2 WebContainer Sandbox

- Browser-native Bun environment
- Network support (via proxy for CORS)
- Full isolation for security
- Real-time preview and testing

---

## 7. Composable Apps

```typescript
import npmUpdater from "github.com/user/npm-updater"
import changelog from "github.com/user/changelog-gen"

export default defineApp({
  name: "release-helper",
  tools: [
    tool({
      name: "release",
      inputSchema: z.object({ version: z.string() }),
      execute: async ({ version }, ctx) => {
        await ctx.run(npmUpdater, { global: false })
        await ctx.run(changelog, { since: `v${version}` })
        return `Released v${version}`
      },
    }),
  ],
})
```

---

## 8. Technical Stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| Runtime        | Bun                                                |
| Type Safety    | TypeScript + Standard Schema (Zod/Valibot/ArkType) |
| TUI            | @clack/prompts                                     |
| Build          | tsdown                                             |
| Distribution   | GitHub-first + Cloudflare Workers                  |
| Web IDE        | WebContainer API + xterm.js                        |
| AI Integration | MCP Protocol Compatible                            |

---

## 9. Architecture Positioning

kly is the **"Terminal OS"** microkernel:

```
┌─────────────────────────────────────────────────────────────┐
│                        kly                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Kernel: Bun (extreme speed)                            ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Interface: Zod + tool() / defineApp() (type-safe)      ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Brain: LLM (fuzzy intent handling)                     ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Peripherals: MCP / Skills (ecosystem integration)      ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Address: kly.sh (decentralized distribution)          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 10. AI Integration Architecture

### 10.1 Natural Language Processing Flow

```
User Input: "What's the weather in Beijing?"
     │
     ├─▶ isNaturalLanguage() ──▶ Detect: spaces, questions, common words
     │                            Result: true
     │
     ├─▶ Multi-tool app? ──▶ selectTool()
     │   ├─ Input: user input + tool descriptions
     │   ├─ LLM: "current" or "forecast"
     │   └─ Output: selected tool name
     │
     └─▶ parseNaturalLanguage()
         ├─ Cache check (hit? return cached)
         ├─ Extract JSON schema from StandardSchemaV1
         ├─ Build system prompt with schema
         ├─ Call LLM (OpenAI/Anthropic)
         ├─ Parse JSON response
         ├─ Merge with CLI flags (flags take precedence)
         └─ Cache result & return
```

### 10.2 Provider Detection & Configuration

```typescript
// Configuration from ~/.kly/config.json
getCurrentModelConfig():
  1. Read config from ~/.kly/config.json
  2. Return current model configuration
  3. null → Error: "Run 'kly models' to configure"

// Configuration managed via interactive command
kly models:
  - Add new model configuration
  - Switch between configured models
  - List/remove models
  - All providers supported (OpenAI, Anthropic, Google, etc.)
```

### 10.3 Smart Tool Selection

For multi-tool apps, AI automatically selects the appropriate tool:

```typescript
// Example: Weather app with "current" and "forecast" tools
selectTool(
  "Will it rain tomorrow?",  // User input
  [
    { name: "current", description: "Get current weather" },
    { name: "forecast", description: "Get weather forecast" }
  ]
)
// → LLM analyzes intent → Returns "forecast"
```

### 10.4 Parameter Extraction Caching

```typescript
// In-memory LRU cache (max 100 entries)
parameterCache: Map<cacheKey, extractedParams>

cacheKey = hash(naturalInput + schema + providedArgs)

// Cache hit: Instant return (~0ms vs 500-2000ms)
// Cache miss: LLM call + cache store
```

### 10.5 Reasoning Model Compatibility

```typescript
// OpenAI reasoning models (o1, o3, gpt-5) don't support temperature
const isReasoningModel =
  modelName.includes("o1") ||
  modelName.includes("o3") ||
  modelName.includes("gpt-5")

await generateText({
  model,
  ...(isReasoningModel ? {} : { temperature: 0 }),
  system: systemPrompt,
  prompt: userInput,
})
```

### 10.6 Error Handling

````typescript
try {
  // LLM call with spinner
  const { text } = await generateText(...)
  spinner.succeed("Parameters extracted")

  // Parse & validate JSON
  const cleaned = text.replace(/```json\s*|\s*```/g, "")
  const parsed = JSON.parse(cleaned)

  return { ...parsed, ...providedArgs }
} catch (error) {
  spinner.fail("Failed to analyze request")
  throw new Error("Detailed error message...")
}
````

---

## 11. Risks & Mitigations

### 11.1 Bun Compatibility

**Risk**: Some npm packages may have Bun compatibility issues.

**Mitigation**: Keep Node.js fallback path.

### 11.2 Security Sandbox

**Risk**: Monkey-patching `fetch` can be bypassed via dynamic imports.

**Mitigation**:

- Short-term: Best-effort interception via `--preload`
- Long-term: WASM sandbox or isolated process

### 11.3 LLM API Costs

**Risk**: Frequent natural language usage can incur API costs.

**Mitigation**:

- In-memory caching (100 entries) for repeated queries
- Fast, cheap models by default (gpt-4o-mini, claude-3-5-haiku)
- Users can override with environment variables

---

> This is a battle from **Protocol** to **Platform**.
