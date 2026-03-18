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
│ Scanner  │ Git      │ Parser   │ LLM Service        │
│ (globby) │(git CLI) │(tree-sitter)│ (pi-ai)         │
├──────────┴──────────┴──────────┴────────────────────┤
│              Database (SQLite)                        │
│         .kly/db/<branch>.db (per-branch)             │
└─────────────────────────────────────────────────────┘
```

### Entry Points

| Entry   | File           | Purpose                                  |
| ------- | -------------- | ---------------------------------------- |
| Library | `src/index.ts` | Public API for programmatic usage        |
| CLI     | `src/cli.ts`   | `kly` command-line tool                  |
| MCP     | `src/mcp.ts`   | MCP Server (stdio) for agent integration |

## Data Flow

### Git-Aware Mode (default in git repos)

```
git.ts (detect branch/commit)
  → state.yaml (last indexed commit?)
    → git diff (changed files only)
      → diff-filter.ts (match include/exclude)
        → parser/ (tree-sitter AST)
          → llm/ (generate descriptions)
            → database.ts (SQLite upsert)
              → state.yaml (update last commit)
```

### Classic Mode (non-git or --full)

```
scanner.ts → hasher.ts (SHA-256 diff) → parser/ (tree-sitter AST) → llm/ (generate descriptions) → database.ts (SQLite upsert)
```

### Build Pipeline Steps

1. **Detect** — Check if inside a git repo; determine branch and current commit
2. **Diff** — Use `git diff --name-status` between last indexed commit and HEAD to find changed files
3. **Filter** — Match diff results against `include`/`exclude` glob patterns
4. **Parse** — Extract imports, exports, and symbols using tree-sitter AST
5. **LLM** — Send file content + detected symbols to LLM for metadata generation
6. **Store** — Upsert `FileIndex` entries into per-branch SQLite database
7. **State** — Update `state.yaml` with current commit hash

## Storage Layer

### SQLite with FTS5

Each branch gets its own SQLite database under `.kly/db/`:

```
.kly/
  config.yaml                     # LLM and glob settings
  state.yaml                      # Tracks last indexed commit per branch
  db/
    main.db                       # main branch
    feature--auth.db              # feature/auth (/ → --)
    _detached--a1b2c3d4.db        # detached HEAD
    default.db                    # non-git repositories
```

**Schema:**

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL,
  imports TEXT NOT NULL DEFAULT '[]',     -- JSON array
  exports TEXT NOT NULL DEFAULT '[]',     -- JSON array
  symbols TEXT NOT NULL DEFAULT '[]',     -- JSON array of {name, kind, description}
  summary TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  indexed_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE files_fts USING fts5(
  path, name, description, summary, symbols_text,
  content=files, content_rowid=rowid
);

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Why SQLite over YAML:**

| Dimension | YAML (old) | SQLite (current) |
|-----------|-----------|------------------|
| Read 1 file's index | Parse entire file O(n) | Primary key query O(1) |
| Search | Full scan + JS scoring | FTS5 full-text search |
| Write single entry | Rewrite entire file | UPDATE single row |
| 10k file repo | ~5-10MB YAML, slow parse | ~2-3MB SQLite, ms queries |
| Concurrency | None | WAL mode, multi-read |

### State File (`state.yaml`)

```yaml
version: 2
configHash: "sha256..."       # Hash of include/exclude config
branches:
  main:
    lastCommit: "a1b2c3d4..."
    lastBuilt: 1710700000000
  feature--auth:
    lastCommit: "f6e5d4c3..."
    lastBuilt: 1710700100000
    forkedFrom: main
```

## Core Types

```typescript
type Language = "typescript" | "javascript" | "swift";

interface FileIndex {
  path: string;         // relative to repo root
  name: string;         // LLM-generated human-readable name
  description: string;  // one-line description
  language: Language;
  imports: string[];    // extracted by tree-sitter
  exports: string[];    // extracted by tree-sitter
  symbols: SymbolInfo[];
  summary: string;      // 2-3 sentence summary
  hash: string;         // SHA-256 for incremental builds
  indexedAt: number;    // timestamp
}

interface GitDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
}

interface GitState {
  version: number;
  configHash: string;
  branches: Record<string, BranchState>;
}

interface BranchState {
  lastCommit: string;
  lastBuilt: number;
  forkedFrom?: string;
}
```

## Design Decisions

### SQLite over YAML

The index storage migrated from a single `.kly/index.yaml` to per-branch SQLite databases. This enables O(1) file lookups, FTS5 full-text search, transactional writes, and efficient per-branch isolation.

### Git-Aware Incremental Builds

Instead of hashing every file to detect changes (O(all files)), kly uses `git diff` between the last indexed commit and HEAD. This makes incremental builds O(changed files) — near-instant for typical commits.

### Per-Branch Databases

Each git branch gets its own `.db` file. Switching branches has zero overhead — just open the corresponding database. New branches can fork from a parent branch's database to avoid full rebuilds.

### Multi-Provider LLM via pi-ai

Uses [pi-ai](https://github.com/badlogic/pi-mono) unified LLM API instead of a provider-specific SDK. This allows users to choose any supported provider during `kly init`.

### Interactive CLI via @clack/prompts

All CLI user interactions use [@clack/prompts](https://github.com/bombshell-dev/clack) for a modern, consistent terminal experience.

## Code Conventions

- **No `as any` or `as unknown`** — Use proper type narrowing
- **English code and comments** — All code, variable names, and comments must be in English
- **YAML for config** — Configuration uses YAML; index data uses SQLite
- **>90% test coverage** — Enforced via `npm run test:coverage`

## Module Details

### Database (`src/database.ts`)

SQLite-based storage using `better-sqlite3`. Provides:

- **CRUD**: `getFile()`, `upsertFile()`, `upsertFiles()`, `removeFile()`, `removeFiles()`
- **FTS5 Search**: `searchFiles()` — full-text search across path, name, description, summary, symbols
- **Stats**: `getFileCount()`, `getLanguageStats()`
- **Metadata**: `getMetadata()`, `setMetadata()`
- **Batch writes**: Transaction-wrapped for atomicity and performance

### Git (`src/git.ts`)

Git CLI wrapper via `child_process.execSync`:

- `isGitRepo()` — detect git repository
- `getCurrentBranch()` — current branch name (null for detached HEAD)
- `getCurrentCommit()` — current HEAD commit hash
- `getChangedFiles()` — `git diff --name-status` between two commits
- `isAncestor()` — verify commit ancestry (detects rebase/force-push)
- `getMergeBase()` — find common ancestor between branches
- `branchToDbName()` — convert branch name to safe db filename

### Diff Filter (`src/diff-filter.ts`)

Filters `git diff` results against `include`/`exclude` glob patterns using `picomatch`. Returns categorized lists: `toIndex`, `toDelete`, `renamed`.

### Store (`src/store.ts`)

Branch-aware database management:

- `openDatabase()` — open/create SQLite database for current branch
- `resolveDbName()` — determine db filename from git state
- `copyDatabase()` — fork parent branch's db for new branches
- `loadState()` / `saveState()` — manage `state.yaml`
- `listBranchDbs()` / `removeBranchDb()` — cleanup operations

### Scanner (`src/scanner.ts`)

Uses `globby` to discover files matching `include` patterns while excluding `exclude` patterns. Respects `.gitignore` by default.

### Hasher (`src/hasher.ts`)

Computes SHA-256 hash of file contents for change detection. Used as fallback when git diff is unavailable.

### Parser (`src/parser/`)

Tree-sitter based static analysis. Extracts structural information without executing code.

| Parser     | File Extensions              | Extracted Symbols                                        |
| ---------- | ---------------------------- | -------------------------------------------------------- |
| TypeScript | `.ts`, `.tsx`, `.js`, `.jsx` | class, function, method, interface, type, enum, variable |
| Swift      | `.swift`                     | class, struct, protocol, function, enum                  |

### LLM Service (`src/llm/`)

Calls LLM via [pi-ai](https://github.com/badlogic/pi-mono) unified API to generate human-readable metadata for each file.

### Indexer (`src/indexer.ts`)

Main orchestration engine with two build paths:

1. **Git-aware** (default in git repos): Uses `git diff` for O(changed files) incremental builds
2. **Classic** (non-git or `--full`): Scans all files, uses SHA-256 hash comparison

Handles edge cases: rebase/force-push (falls back to hash-based), config changes (forces full rebuild), new branches (forks from parent db).

### Query (`src/query.ts`)

Delegates to FTS5 full-text search in SQLite. Also provides utility filters: `filterByLanguage()`, `filterByPath()`.

## CLI Commands

| Command            | Description                                              | Key Options                                |
| ------------------ | -------------------------------------------------------- | ------------------------------------------ |
| `kly init`         | Interactive setup + optional post-commit hook install     | —                                          |
| `kly build`        | Build index (git-incremental by default)                  | `--full` force rebuild, `--quiet` for hooks |
| `kly query <text>` | Search files by natural language description (FTS5)       | —                                          |
| `kly show <path>`  | Display detailed index for a specific file                | —                                          |
| `kly serve`        | Start MCP stdio server                                    | —                                          |
| `kly hook <action>`| Install/uninstall post-commit hook                        | `install` or `uninstall`                   |
| `kly gc`           | Clean up databases for deleted branches                   | —                                          |

## MCP Server

Exposes 3 tools via stdio transport for agent consumption:

### `search_files`

Natural language file search powered by FTS5.

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

## Directory Structure

```
kly/
├── src/
│   ├── index.ts              # Library public API
│   ├── cli.ts                # CLI entry (commander)
│   ├── mcp.ts                # MCP Server (stdio)
│   ├── types.ts              # Core types
│   ├── config.ts             # .kly/ directory management
│   ├── database.ts           # SQLite IndexDatabase class
│   ├── git.ts                # Git CLI wrapper
│   ├── diff-filter.ts        # Git diff glob filtering
│   ├── scanner.ts            # File discovery (globby)
│   ├── hasher.ts             # SHA-256 hashing
│   ├── store.ts              # Branch-aware db management
│   ├── indexer.ts            # Pipeline orchestration
│   ├── query.ts              # FTS5 search & filtering
│   ├── commands/
│   │   ├── init.ts
│   │   ├── build.ts
│   │   ├── query.ts
│   │   ├── show.ts
│   │   ├── serve.ts
│   │   ├── hook.ts           # Git hook install/uninstall
│   │   └── gc.ts             # Branch db cleanup
│   ├── llm/
│   │   ├── index.ts          # LLMService
│   │   ├── prompts.ts        # Prompt templates
│   │   └── batcher.ts        # Concurrency control
│   ├── parser/
│   │   ├── base.ts           # Abstract BaseParser
│   │   ├── index.ts          # ParserManager
│   │   ├── typescript.ts     # TS/TSX/JS/JSX parser
│   │   └── swift.ts          # Swift parser
│   └── __tests__/
│       ├── helpers/fixtures.ts
│       ├── config.test.ts
│       ├── database.test.ts
│       ├── git.test.ts
│       ├── diff-filter.test.ts
│       ├── integration.test.ts
│       ├── store.test.ts
│       ├── query.test.ts
│       ├── indexer.test.ts
│       ├── scanner.test.ts
│       ├── hasher.test.ts
│       ├── parser/
│       └── llm/
├── .kly/
│   ├── config.yaml
│   ├── state.yaml
│   └── db/
│       ├── main.db
│       └── <branch>.db
├── package.json
└── vite.config.ts
```

## Tech Stack

| Component       | Technology                     | Purpose                                                                      |
| --------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| Build           | VP (vite-plus) / tsdown        | Bundle 3 entry points to ESM                                                 |
| LLM             | `@mariozechner/pi-ai`          | Unified multi-provider LLM API                                               |
| Static Analysis | `tree-sitter`                  | AST parsing (TS/JS/Swift)                                                    |
| Storage         | `better-sqlite3`               | Per-branch SQLite with FTS5 full-text search                                 |
| MCP             | `@modelcontextprotocol/sdk`    | Agent-facing tool protocol                                                   |
| File Discovery  | `globby`                       | Glob patterns with gitignore                                                 |
| CLI             | `commander` + `@clack/prompts` | Command-line interface with interactive prompts                              |
| Concurrency     | `p-limit`                      | Rate limit LLM calls                                                         |
| Serialization   | `yaml`                         | YAML config and state                                                        |
| Validation      | `zod`                          | Schema validation                                                            |

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Detached HEAD | Uses `_detached--<commit8>` as db filename |
| Rebase/Force push | `isAncestor` check fails → falls back to hash-based incremental |
| Branch deletion | `kly gc` cleans up corresponding .db file |
| Merge commit | `git diff` correctly covers all changes from merge |
| Non-git repo | Uses `default.db` with hash-based incremental |
| Renamed files | Copies existing index, re-indexes if content changed |
| Config change | Detects `configHash` change → forces full rebuild |

## Roadmap

### P0 (Done)

- Project skeleton with 3 entry points
- Core modules: scanner, hasher, store, config
- Tree-sitter parsers: TypeScript, JavaScript, Swift
- LLM integration with multi-provider support
- CLI: init, build, query, show, serve, hook, gc
- MCP Server with stdio transport
- Git-aware incremental indexing with per-branch SQLite storage
- FTS5 full-text search
- Post-commit hook system

### P1

- `kly overview` — repository-level summary command
- `kly graph` — dependency graph visualization (Mermaid)
- LLM rerank for query results
- npm publish
- SSE transport for MCP

### P2

- Architecture visualization (module dependency diagrams)

### P3

- Cloud batch indexing for GitHub repositories

### P4

- Embedding-based semantic search (paid API)
