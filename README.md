# kly

**English** | [中文](README.zh-CN.md)

Code repository file-level indexing tool for AI agents.

kly scans your codebase, extracts structural information via tree-sitter AST, and uses LLM to generate human-readable metadata for every file. The result is a structured index that lets agents find the right file with minimal tokens.

## Features

- **Tree-sitter AST parsing** — Extract imports, exports, and symbols from TypeScript, JavaScript, and Swift
- **Multi-provider LLM** — Generate metadata via OpenRouter, Anthropic, OpenAI, Google, Mistral, Groq, and more (powered by [pi-ai](https://github.com/badlogic/pi-mono))
- **Git-aware incremental builds** — Tracks git history per branch, only re-indexes files changed since last commit
- **SQLite storage** — Per-branch SQLite databases with FTS5 full-text search, replacing single YAML file
- **MCP Server** — Expose index as tools for agent consumption (stdio transport)
- **Post-commit hook** — Automatic indexing after every commit
- **Dependency graph** — Visualize file dependencies as Mermaid diagrams (ASCII, SVG, or raw syntax)
- **LLM rerank** — Optionally rerank search results using LLM for better semantic relevance
- **Simple CLI** — `init`, `build`, `query`, `show`, `overview`, `graph`, `serve`, `hook`, `gc`

## Install

```bash
npm install -g kly
```

## Quick Start

```bash
# Interactive setup: select provider, enter API key, choose model
kly init

# Build the index (git-incremental by default in git repos)
kly build

# Search files by description (powered by FTS5)
kly query "authentication middleware"

# Search with LLM reranking for better relevance
kly query "authentication middleware" --rerank

# Show detailed index for a file
kly show src/auth.ts

# Repository overview with language breakdown
kly overview

# Visualize file dependency graph
kly graph
kly graph --focus src/auth.ts --depth 3
kly graph --format mermaid > deps.mmd

# Start MCP server for agent integration
kly serve

# Install post-commit hook for automatic indexing
kly hook install

# Clean up databases for deleted branches
kly gc
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

## MCP Integration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "kly": {
      "command": "kly",
      "args": ["serve"],
      "cwd": "/path/to/your/repo"
    }
  }
}
```

Available tools:

- `search_files` — Natural language file search (FTS5 full-text search, optional LLM rerank)
- `get_file_index` — Get detailed metadata for a specific file
- `get_overview` — Repository summary with language breakdown

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
