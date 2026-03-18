# kly

**English** | [中文](README.zh-CN.md)

Code repository file-level indexing tool for AI agents.

kly scans your codebase, extracts structural information via tree-sitter AST, and uses LLM to generate human-readable metadata for every file. The result is a structured index that lets agents find the right file with minimal tokens.

## Features

- **Tree-sitter AST parsing** — Extract imports, exports, and symbols from TypeScript, JavaScript, and Swift
- **Multi-provider LLM** — Generate metadata via OpenRouter, Anthropic, OpenAI, Google, Mistral, Groq, and more (powered by [pi-ai](https://github.com/badlogic/pi-mono))
- **Incremental builds** — SHA-256 hashing skips unchanged files
- **MCP Server** — Expose index as tools for agent consumption (stdio transport)
- **YAML storage** — Config and index use YAML for fewer tokens and better agent readability
- **Simple CLI** — `init`, `build`, `query`, `show`, `serve`

## Install

```bash
npm install -g kly
```

## Quick Start

```bash
# Interactive setup: select provider, enter API key, choose model
kly init

# Build the index
kly build

# Search files by description
kly query "authentication middleware"

# Show detailed index for a file
kly show src/auth.ts

# Start MCP server for agent integration
kly serve
```

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

- `search_files` — Natural language file search
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
