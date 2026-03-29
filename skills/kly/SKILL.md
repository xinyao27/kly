---
name: kly
description: "Use kly CLI to navigate and understand codebases efficiently. Trigger whenever you need to find files by purpose (not just name), understand repository structure, trace dependencies between files, debug error stacks, or explore an unfamiliar codebase. Also trigger when the working directory contains a .kly/ folder, or when the user mentions kly, code indexing, or file-level search. Prefer kly over blind grep/glob when you need semantic understanding of what files do rather than exact string matching."
---

# kly — Codebase Navigation for AI Agents

kly is a file-level indexing tool that gives you semantic understanding of a codebase. Every file has LLM-generated metadata (name, description, summary, symbols), stored in a per-branch SQLite database with FTS5 full-text search.

## When to Use kly vs Grep/Glob

| Task                                                    | Best tool        | Why                                                |
| ------------------------------------------------------- | ---------------- | -------------------------------------------------- |
| Find files by **purpose** ("authentication middleware") | `kly query`      | Semantic search across LLM-generated descriptions  |
| Find files by **exact code** (`class AuthService`)      | Grep             | Exact string matching is faster and precise        |
| Understand **repo structure** at a glance               | `kly overview`   | Structured summary in one call                     |
| Find files by **name pattern** (`*.test.ts`)            | Glob             | Pattern matching is the right tool                 |
| Trace **who depends on** a file                         | `kly dependents` | Pre-computed dependency graph                      |
| Debug an **error stack trace**                          | `kly enrich`     | Adds file context, deps, and git history to frames |
| Visualize **dependency graph**                          | `kly graph`      | Mermaid/ASCII/SVG output ready                     |
| Find a file's **role and exports**                      | `kly show`       | All metadata in one JSON response                  |

**The optimal workflow: kly first for semantic discovery, then Grep/Glob for precise code-level search.**

## Prerequisites

### Install

```bash
npm install -g kly
# or
bun install -g kly
```

### Check if kly is Ready

Before using kly, verify the setup status step by step:

```bash
# Step 1: Check if kly is installed
which kly || echo "NOT INSTALLED"

# Step 2: Check if kly has been initialized (.kly/config.yaml must exist)
ls .kly/config.yaml 2>/dev/null || echo "NOT INITIALIZED"

# Step 3: Check if the index has been built (.kly/db/*.db must exist)
ls .kly/db/*.db 2>/dev/null || echo "NOT BUILT"
```

**What to do based on results:**

| Status          | Action                                                                               |
| --------------- | ------------------------------------------------------------------------------------ |
| NOT INSTALLED   | `npm install -g kly` or `bun install -g kly`                                         |
| NOT INITIALIZED | `kly init --provider openrouter --api-key <key>` (ask user for provider and API key) |
| NOT BUILT       | `kly build` (first build indexes all files, takes a few minutes)                     |
| All checks pass | Ready to use. Run `kly build` if index might be stale (incremental, near-instant).   |

If you run any kly command on an uninitialized project, it will error with:

```
Error: Not initialized.
  kly init --provider <provider> --api-key <key>
```

## Command Reference

### Discover: Find the right files

```bash
# Semantic search — finds files by what they DO, not just what they're named
kly query "authentication middleware"
kly query "error handling" --limit 5

# Higher quality results with LLM reranking (slower, uses API)
kly query "database migration" --rerank
```

Output is JSON by default (agent-friendly). Each result includes `path`, `name`, `description`, `summary`, `score`.

### Inspect: Understand a specific file

```bash
# Full metadata for a file — description, imports, exports, symbols, summary
kly show src/auth.ts
```

Use this before reading the actual file to decide if it's the right one. Saves tokens compared to reading file contents.

### Navigate: Trace dependencies

```bash
# Who imports this file? (reverse dependencies)
kly dependents src/database.ts

# Dependency graph focused on a file
kly graph --focus src/auth.ts --depth 3

# Full repo dependency graph
kly graph --format mermaid
kly graph --format json
```

Graph formats: `mermaid` (default, agent-friendly), `json` (structured), `ascii` (visual), `svg` (image).

### Understand: Repo-level overview

```bash
# Repository summary — file count, language breakdown, indexed status
kly overview
```

Use this as the first command when entering an unfamiliar codebase.

### Debug: Enrich error stacks

```bash
# Pipe error frames to get file context, dependencies, and git history
echo '[{"file":"src/auth.ts","line":42}]' | kly enrich

# Or pass frames directly
kly enrich --frames '[{"file":"src/auth.ts","line":42,"function":"validate"}]'
```

Each frame gets enriched with: file description, summary, symbols near the line, dependent files, and recent git history.

### History: Recent changes

```bash
# Recent git commits touching a file
kly history src/auth.ts
kly history src/auth.ts --limit 10
```

### Maintenance

```bash
# Rebuild index from scratch (after major refactor)
kly build --full

# Incremental update (after normal commits, near-instant)
kly build

# Install post-commit hook for automatic indexing
kly hook install

# Clean up databases for deleted branches
kly gc
```

## Workflow Patterns

### Pattern 1: Explore an unfamiliar codebase

```
1. kly overview                          → understand repo size and languages
2. kly query "main entry point"          → find where the app starts
3. kly graph --format mermaid            → see overall architecture
4. kly show <interesting-file>           → drill into specific files
```

### Pattern 2: Find where to make a change

```
1. kly query "<feature description>"     → find candidate files
2. kly show <candidate>                  → verify it's the right file
3. kly dependents <candidate>            → understand blast radius
4. Read/Grep the actual file             → make the change
```

### Pattern 3: Debug an error

```
1. kly enrich < error-frames.json        → get context for each stack frame
2. kly dependents <failing-file>         → find what feeds into it
3. kly history <failing-file>            → check recent changes
4. Grep for the specific error           → pinpoint the bug
```

### Pattern 4: Understand a module's impact

```
1. kly show <module>                     → see what it exports
2. kly dependents <module>               → who uses it
3. kly graph --focus <module> --depth 2  → visualize the dependency neighborhood
```

## Output Format

All commands output JSON by default. Add `--pretty` for human-readable format.

JSON output is ideal for agent consumption — pipe it, parse it, use it in your reasoning. Avoid `--pretty` in automated workflows.

## Key Details

- **Per-branch databases**: kly maintains separate indexes per git branch under `.kly/db/`. Switching branches automatically uses the right index.
- **Incremental builds**: After the first full build, `kly build` only re-indexes files changed since the last indexed commit. It's fast enough to run on every commit.
- **Supported languages**: TypeScript, JavaScript (including TSX/JSX), and Swift.
- **Search ranking**: FTS5 BM25 ranking by default. `--rerank` flag uses LLM for better semantic relevance at the cost of an API call.
