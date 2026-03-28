# kly

Code repository file-level indexing tool for AI agents.

kly scans your codebase, extracts structural information via tree-sitter AST, and uses LLM to generate human-readable metadata for every file. The result is a structured index that lets agents find the right file with minimal tokens.

## Features

- **Tree-sitter AST parsing** — Extract imports, exports, and symbols from TypeScript, JavaScript, and Swift
- **Multi-provider LLM** — Generate metadata via OpenRouter, Anthropic, OpenAI, Google, Mistral, Groq, and more
- **Git-aware incremental builds** — Per-branch SQLite databases, only re-indexes changed files
- **FTS5 full-text search** — BM25 ranking with optional LLM rerank
- **Dependency graph** — File-level dependency tracking with reverse dependency queries
- **Error stack enrichment** — Enrich error stack frames with file context, dependencies, and git history
- **Agent-first CLI** — JSON output by default, `--pretty` for humans, stdin/pipe support
- **Post-commit hook** — Automatic indexing after every commit

## Install

```bash
npm install -g kly
```

## Quick Start

```bash
# Initialize (non-interactive with flags, or interactive without)
kly init --provider openrouter --api-key sk-or-xxx

# Build the index
kly build

# Search files (JSON output by default)
kly query "authentication middleware"

# Human-readable output
kly query "authentication middleware" --pretty

# Show file details
kly show src/auth.ts

# Who imports this file?
kly dependents src/database.ts

# Recent git changes
kly history src/auth.ts

# Enrich error stack with code context
echo '[{"file":"src/auth.ts","line":42}]' | kly enrich

# Dependency graph
kly graph --focus src/auth.ts --depth 3

# Repository overview
kly overview

# Install post-commit hook
kly hook install

# Clean up databases for deleted branches
kly gc
```

## Commands

| Command | Description |
|---|---|
| `kly init` | Initialize kly (supports `--provider`, `--api-key`, `--model` flags) |
| `kly build` | Build or update the index (`--full` for rebuild, `--quiet` for CI) |
| `kly query <text>` | Search files by natural language (`--rerank`, `--limit`) |
| `kly show <path>` | Show indexed metadata for a file |
| `kly overview` | Repository summary with language breakdown |
| `kly graph` | File dependency graph (`--focus`, `--depth`) |
| `kly dependents <path>` | Show files that import the given file |
| `kly history <path>` | Show git modification history (`--limit`) |
| `kly enrich` | Enrich error stack frames (stdin or `--frames`) |
| `kly hook install\|uninstall` | Manage post-commit hook |
| `kly gc` | Remove databases for deleted branches |

All read commands support `--pretty` for human-readable output. Default is JSON.

## How It Works

In a git repository, kly maintains **per-branch SQLite databases** under `.kly/db/`:

```
.kly/
  config.yaml           # LLM and glob settings
  state.yaml            # Tracks last indexed commit per branch
  db/
    main.db             # main branch index
    feature--auth.db    # feature/auth branch (/ → --)
```

After the first full build, subsequent builds use `git diff` to only re-index changed files — making incremental builds near-instant.

## Library Usage

kly is also a TypeScript library with clean exports:

```typescript
import {
  openDatabase,
  searchFiles,
  buildDependencyGraph,
  enrichErrorStack,
  getFileHistory,
  buildIndex,
} from "kly";

// Search files
const db = openDatabase("/path/to/repo");
const results = searchFiles(db, "authentication", 10);

// Enrich error stack
const enriched = enrichErrorStack(db, "/path/to/repo", [
  { file: "src/auth.ts", line: 42, function: "validate" },
]);

db.close();
```

## Configuration

Edit `.kly/config.yaml` to customize:

```yaml
llm:
  provider: openrouter
  model: anthropic/claude-haiku-4.5
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
```

## Documentation

- [Technical Documentation](docs/technical.md) ([中文](docs/technical.zh-CN.md)) — Architecture, data flow, core types, module breakdown
- [Testing Documentation](docs/testing.md) ([中文](docs/testing.zh-CN.md)) — Test strategy, coverage, manual test checklist

## License

MIT
