# kly Technical Documentation

**English** | [中文](technical.zh-CN.md)

> This document is designed for AI agents and developers who need to understand kly's architecture, data flow, and implementation details.

## Overview

kly is a code repository file-level indexing tool. It generates structured metadata for every source file in a repository — including name, description, imports, exports, symbols, and summary — so that AI agents can locate the right file with minimal token consumption.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     CLI / MCP                        │
│  (commander)            (stdio transport)            │
├─────────────────────────────────────────────────────┤
│                     Indexer                           │
│              (orchestration engine)                   │
├──────────┬──────────┬──────────┬────────────────────┤
│ Scanner  │ Hasher   │ Parser   │ LLM Service        │
│ (globby) │ (SHA256) │(tree-sitter)│ (pi-ai)         │
├──────────┴──────────┴──────────┴────────────────────┤
│                     Store                            │
│              (.kly/index.yaml)                        │
└─────────────────────────────────────────────────────┘
```

### Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Library | `src/index.ts` | Public API for programmatic usage |
| CLI | `src/cli.ts` | `kly` command-line tool |
| MCP | `src/mcp.ts` | MCP Server (stdio) for agent integration |

## Data Flow

```
scanner.ts  →  hasher.ts (incremental diff)  →  parser/ (tree-sitter AST)  →  llm/ (generate descriptions)  →  store.ts
```

1. **Scan** — Discover files via glob patterns, respecting `.gitignore` and config exclusions
2. **Hash** — Compute SHA-256 for each file; skip unchanged files in incremental mode
3. **Parse** — Extract imports, exports, and symbols using tree-sitter AST
4. **LLM** — Send file content + detected symbols to LLM (via pi-ai, supports OpenRouter/Anthropic/OpenAI/Google/etc.); receive structured metadata (name, description, summary, symbol descriptions)
5. **Store** — Upsert `FileIndex` entries into `.kly/index.yaml`

## Core Types

```typescript
type Language = "typescript" | "javascript" | "swift"

type SymbolKind =
  | "class" | "function" | "method" | "interface"
  | "type" | "enum" | "variable" | "protocol" | "struct"

interface SymbolInfo {
  name: string
  kind: SymbolKind
  description: string       // LLM-generated
}

interface FileIndex {
  path: string              // relative to repo root
  name: string              // LLM-generated human-readable name
  description: string       // one-line description
  language: Language
  imports: string[]          // extracted by tree-sitter
  exports: string[]          // extracted by tree-sitter
  symbols: SymbolInfo[]
  summary: string            // 2-3 sentence summary
  hash: string               // SHA-256 for incremental builds
  indexedAt: number           // timestamp
}

interface IndexStore {
  version: number
  generatedAt: number
  files: FileIndex[]
}

interface KlyConfig {
  llm: {
    provider: string         // "openrouter", "anthropic", "openai", etc.
    model: string            // "anthropic/claude-haiku-4-5-20251001"
    apiKey: string            // stored in config, set during `kly init`
  }
  include: string[]          // glob patterns
  exclude: string[]          // glob patterns
}

interface ParseResult {
  imports: string[]
  exports: string[]
  symbols: SymbolInfo[]
}
```

## Design Decisions

### YAML over JSON

All `.kly/` storage files (config and index) use YAML instead of JSON:
- **Fewer tokens** — YAML omits braces, brackets, and quotes for keys, resulting in significantly fewer tokens when consumed by LLMs
- **Better agent readability** — Cleaner structure for AI agents to parse and reason about
- **Human-friendly** — Easier to hand-edit without syntax errors

### Multi-Provider LLM via pi-ai

Uses [pi-ai](https://github.com/badlogic/pi-mono) unified LLM API instead of a provider-specific SDK. This allows users to choose any supported provider (OpenRouter, Anthropic, OpenAI, Google, Mistral, Groq, xAI, etc.) during `kly init`. API keys are stored in `.kly/config.yaml`, not environment variables.

### Interactive CLI via @clack/prompts

All CLI user interactions use [@clack/prompts](https://github.com/bombshell-dev/clack) for a modern, consistent terminal experience — select menus, password input, spinners, and structured log output.

## Code Conventions

- **No `as any` or `as unknown`** — Use proper type narrowing, generics, or wrapper functions with explicit signatures instead of type assertions that bypass the type system
- **English code and comments** — All code, variable names, and comments must be in English
- **YAML for storage** — Any config or data persisted by kly must use YAML format

## Module Details

### Scanner (`src/scanner.ts`)

Uses `globby` to discover files matching `include` patterns while excluding `exclude` patterns. Respects `.gitignore` by default. Returns relative paths sorted alphabetically.

### Hasher (`src/hasher.ts`)

Computes SHA-256 hash of file contents for change detection. Used in incremental mode to skip files that haven't changed since last index.

### Parser (`src/parser/`)

Tree-sitter based static analysis. Extracts structural information without executing code.

| Parser | File Extensions | Extracted Symbols |
|--------|----------------|-------------------|
| TypeScript | `.ts`, `.tsx` | class, function, method, interface, type, enum, variable |
| JavaScript | `.js`, `.jsx` | class, function, method, enum, variable |
| Swift | `.swift` | class, struct, protocol, function, enum |

**Parser Architecture:**
- `base.ts` — Abstract `BaseParser` class with `parse()` and `supports()` methods
- `typescript.ts` — Handles TS/TSX via `tree-sitter-typescript`
- `javascript.ts` — Handles JS/JSX via `tree-sitter-javascript`
- `swift.ts` — Handles Swift via `tree-sitter-swift`
- `index.ts` — `ParserManager` routes files to the correct parser by extension

**AST Node Types Extracted:**

TypeScript/JavaScript:
- Imports: `import_statement`
- Exports: `export_statement`, `export_default_declaration`, `export_clause`
- Symbols: `class_declaration`, `function_declaration`, `method_definition`, `interface_declaration`, `type_alias_declaration`, `enum_declaration`, `lexical_declaration` (with export)

Swift:
- Imports: `import_declaration`
- Exports: all top-level declarations
- Symbols: `class_declaration`, `struct_declaration`, `protocol_declaration`, `function_declaration`, `enum_declaration`

### LLM Service (`src/llm/`)

Calls LLM via [pi-ai](https://github.com/badlogic/pi-mono) unified API to generate human-readable metadata for each file. Supports multiple providers: OpenRouter, Anthropic, OpenAI, Google, Mistral, Groq, xAI, and more.

**Components:**
- `prompts.ts` — System prompt and user prompt templates
- `batcher.ts` — Concurrency-limited batch processing via `p-limit` (default: 5 concurrent requests)
- `index.ts` — `LLMService` class that orchestrates API calls and parses JSON responses

**Prompt Strategy:**
- System prompt instructs LLM to return a JSON object with `name`, `description`, `summary`, and `symbols`
- User prompt includes: file path, detected symbols (from tree-sitter), and full source code
- Response is parsed as JSON (handles markdown code block wrapping)

**Configuration:**
- Default provider: `openrouter`
- Default model: `anthropic/claude-haiku-4-5-20251001`
- API key: stored in `.kly/config.yaml` (set during `kly init`)

### Indexer (`src/indexer.ts`)

Main orchestration engine. Coordinates the full pipeline:

1. Load config and initialize components
2. Scan files → filter changed (incremental) → parse (tree-sitter) → LLM (batch) → store
3. Reports progress via callback: `{ total, completed, currentFile }`

### Store (`src/store.ts`)

YAML-based persistence at `.kly/index.yaml`. Provides CRUD operations:
- `loadStore()` / `saveStore()` — read/write full store
- `upsertFileIndex()` — insert or update by path
- `removeFileIndex()` — delete by path
- `getFileIndex()` — lookup by path

### Query (`src/query.ts`)

Text-based search with relevance scoring:
- Splits query into terms
- Scores matches across: name, description, summary, path, symbols, exports
- Applies score boosts for name/path/symbol name matches
- Returns results sorted by score (descending)

Also provides utility filters: `filterByLanguage()`, `filterByPath()`

## CLI Commands

| Command | Description | Key Options |
|---------|-------------|-------------|
| `kly init` | Interactive setup: select provider, enter API key, choose model | — |
| `kly build` | Build full index | `-i, --incremental` skip unchanged files |
| `kly query <text>` | Search files by natural language description | — |
| `kly show <path>` | Display detailed index for a specific file | — |
| `kly serve` | Start MCP stdio server | — |

## MCP Server

Exposes 3 tools via stdio transport for agent consumption:

### `search_files`

Natural language file search.

- **Input:** `{ query: string, limit?: number }`
- **Output:** JSON array of `{ path, name, description, score }`

### `get_file_index`

Retrieve complete index for a specific file.

- **Input:** `{ path: string }`
- **Output:** Full `FileIndex` JSON object

### `get_overview`

Repository summary.

- **Input:** none
- **Output:** `{ totalFiles, languages: { [lang]: count }, files: [{ path, name, description }] }`

## Configuration

Default `.kly/config.yaml`:

```yaml
llm:
  provider: openrouter
  model: anthropic/claude-haiku-4-5-20251001
  apiKey: sk-or-...
include:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.swift"
exclude:
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/build/**"
  - "**/.git/**"
  - "**/.kly/**"
  - "**/vendor/**"
  - "**/*.d.ts"
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
```

## Directory Structure

```
kly/
├── src/
│   ├── index.ts              # Library public API
│   ├── cli.ts                # CLI entry (commander)
│   ├── mcp.ts                # MCP Server (stdio)
│   ├── types.ts              # Core types
│   ├── config.ts             # .kly/ directory management
│   ├── scanner.ts            # File discovery (globby)
│   ├── hasher.ts             # SHA-256 hashing
│   ├── store.ts              # Index YAML persistence
│   ├── indexer.ts            # Pipeline orchestration
│   ├── query.ts              # Search & filtering
│   ├── tree-sitter.d.ts      # Grammar type declarations
│   ├── commands/
│   │   ├── init.ts
│   │   ├── build.ts
│   │   ├── query.ts
│   │   ├── show.ts
│   │   └── serve.ts
│   ├── llm/
│   │   ├── index.ts          # LLMService (Anthropic)
│   │   ├── prompts.ts        # Prompt templates
│   │   └── batcher.ts        # Concurrency control
│   └── parser/
│       ├── base.ts           # Abstract BaseParser
│       ├── index.ts          # ParserManager
│       ├── typescript.ts     # TS/TSX parser
│       ├── javascript.ts     # JS/JSX parser
│       └── swift.ts          # Swift parser
├── .kly/                     # Generated index directory
│   ├── config.yaml
│   └── index.yaml
├── package.json
└── vite.config.ts            # VP (vite-plus) build config
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Build | VP (vite-plus) / tsdown | Bundle 3 entry points to ESM |
| LLM | `@mariozechner/pi-ai` | Unified multi-provider LLM API (OpenRouter, Anthropic, OpenAI, Google, etc.) |
| Static Analysis | `tree-sitter` | AST parsing (TS/JS/Swift) |
| MCP | `@modelcontextprotocol/sdk` | Agent-facing tool protocol |
| File Discovery | `globby` | Glob patterns with gitignore |
| CLI | `commander` + `@clack/prompts` | Command-line interface with interactive prompts |
| Concurrency | `p-limit` | Rate limit LLM calls |
| Serialization | `yaml` | YAML config and index storage |
| Validation | `zod` | Schema validation |

## Roadmap

### P0 (Done)
- Project skeleton with 3 entry points
- Core modules: scanner, hasher, store, config
- Tree-sitter parsers: TypeScript, JavaScript, Swift
- LLM integration with Anthropic Claude
- CLI: init, build (incremental), query, show, serve
- MCP Server with stdio transport

### P1
- `kly overview` — repository-level summary command
- `kly graph` — dependency graph visualization (Mermaid)
- LLM rerank for query results
- File watcher for automatic incremental indexing
- npm publish
- SSE transport for MCP

### P2
- Architecture visualization (module dependency diagrams)

### P3
- Cloud batch indexing for GitHub repositories

### P4
- Embedding-based semantic search (paid API)
