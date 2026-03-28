# kly

Code repository file-level indexing tool for AI agents.

kly scans your codebase, extracts structural information via tree-sitter AST, and uses LLM to generate human-readable metadata for every file. The result is a structured index that lets agents find the right file with minimal tokens.

## CLI Design Principles

kly is a CLI-first tool. Agents consume it via shell commands, not MCP. The CLI design follows these principles:

### Agent-first output

All commands output **JSON by default**. Humans add `--pretty` for readable output. Never the other way around.

```bash
kly query "auth"              # → JSON (for agents)
kly query "auth" --pretty     # → human-readable (for developers)
```

### Non-interactive by default

Every input is passable as a flag. Interactive prompts are a fallback when flags are missing, not the primary path. An agent must never get stuck on a prompt it can't answer.

```bash
# bad: blocks an agent
kly init
# ? Select LLM provider (use arrow keys)

# good: fully scriptable
kly init --provider openrouter --api-key sk-or-xxx --model anthropic/claude-haiku-4.5
```

### Progressive discovery via --help

Don't dump all docs upfront. An agent runs `kly`, sees subcommands, picks one, runs `kly query --help`, gets what it needs. Every `--help` includes **examples** — agents pattern-match off examples faster than descriptions.

```
$ kly query --help

Search indexed files by natural language description

Options:
  --rerank       Use LLM to rerank results
  --limit <n>    Maximum results (default: 10)
  --pretty       Human-readable output

Examples:
  kly query "authentication middleware"
  kly query "error handling" --limit 5
  kly query "database migration" --rerank
```

### Flags and stdin for everything

Agents think in pipelines. Accept flags and stdin. Don't require positional args in weird orders.

```bash
echo '[{"file":"src/auth.ts","line":42}]' | kly enrich
kly enrich --frames '[{"file":"src/auth.ts","line":42}]'
```

### Fail fast with actionable errors

If a required flag is missing, error immediately to stderr and show the correct invocation. Agents self-correct when you give them something to work with.

```
Error: File not found in index: src/foo.ts
  kly build                    # rebuild index first
  kly query "foo"              # search for the right path
```

### Idempotent commands

Agents retry constantly. Running the same command twice must produce the same result, not create duplicates or errors. `kly build` is naturally idempotent (incremental). `kly init` overwrites config if it already exists.

### Return data on success

Show useful structured data, not decorative output. No emoji, no spinner boxes, no color-coded panels. Plain text or JSON that can be piped and parsed.

```
$ kly build
indexed 12 files (3 new, 9 unchanged)
branch: main
commit: abc1234
duration: 2.3s
```

### Predictable command structure

If an agent learns `kly query`, it should be able to guess `kly show`, `kly dependents`. All read commands share the same flags (`--pretty`, `--limit` where applicable). Consistent patterns reduce guessing.

## Commands

```
kly init          # Initialize (supports full flag-driven non-interactive mode)
kly build         # Build or update the repository index
kly query         # Search indexed files by natural language
kly show          # Show indexed metadata for a file
kly overview      # Repository summary with language breakdown
kly graph         # File dependency graph
kly dependents    # Reverse dependency query (who imports this file)
kly history       # File git modification history
kly enrich        # Enrich error stack frames with code context
kly hook          # Install/uninstall post-commit hook
kly gc            # Clean up databases for deleted branches
```

## Quick Start

```bash
# Initialize with flags (agent-friendly)
kly init --provider openrouter --api-key sk-or-xxx

# Or interactive mode (human-friendly, fallback when no flags)
kly init

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

# Install post-commit hook for automatic indexing
kly hook install
```

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
