# kly Testing Documentation

**English** | [中文](testing.zh-CN.md)

## Testing Strategy

kly follows **TDD (Test-Driven Development)** — new features must have tests written first, then implementation. The core modules listed in `vite.config.ts` are held to **100% coverage thresholds**, while CLI and MCP surfaces are verified through targeted smoke tests plus manual end-to-end checks.

## Test Infrastructure

| Component      | Technology                            |
| -------------- | ------------------------------------- |
| Framework      | Vitest 4.1 (via `vp test`)            |
| Coverage       | v8 coverage provider                  |
| Native modules | tree-sitter (prebuilt binaries)       |
| File system    | Real temp directories (`os.tmpdir()`) |
| Mocking        | `vi.mock()` for `@mariozechner/pi-ai` |

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npx vp test --run src/__tests__/hasher.test.ts

# Run tests in watch mode
npx vp test
```

## Test Structure

```
src/__tests__/
├── helpers/
│   └── fixtures.ts              # Shared factory functions
├── config.test.ts               # Config module
├── scanner.test.ts              # Scanner module
├── hasher.test.ts               # Hasher module
├── store.test.ts                # Store module
├── query.test.ts                # Query module
├── commands.test.ts             # Command wrappers and output formatting
├── cli.test.ts                  # Top-level CLI wiring
├── hook.test.ts                 # Hook install/uninstall flows
├── mcp.test.ts                  # MCP tool registration and responses
├── indexer.test.ts              # Indexer integration (mock LLM)
├── parser/
│   ├── typescript.test.ts       # TS/TSX/JS/JSX parser (merged)
│   ├── swift.test.ts            # Swift parser
│   └── manager.test.ts          # ParserManager routing
└── llm/
    ├── prompts.test.ts          # Prompt templates
    ├── batcher.test.ts          # Concurrency control
    └── service.test.ts          # LLMService (mock pi-ai)
```

## Coverage Configuration

Coverage is configured in `vite.config.ts` with 100% thresholds for the files listed in `coverage.include`:

```typescript
test: {
  coverage: {
    provider: "v8",
    thresholds: {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
}
```

**Covered modules:** config, database, diff-filter, git, scanner, hasher, store, query, graph, indexer, parser/_, llm/_

**Outside coverage thresholds:** CLI commands (`src/commands/`), MCP server (`src/mcp.ts`), entry points (`src/cli.ts`, `src/index.ts`)

These paths still have targeted automated tests:

- `src/__tests__/commands.test.ts` — command wrappers, formatting, and failure paths
- `src/__tests__/cli.test.ts` — top-level CLI argument wiring
- `src/__tests__/hook.test.ts` — hook install/uninstall idempotency
- `src/__tests__/mcp.test.ts` — MCP tool registration and JSON payloads

## Mock Strategy

| Module                | When to mock                    | Method                                       |
| --------------------- | ------------------------------- | -------------------------------------------- |
| `@mariozechner/pi-ai` | LLMService tests, Indexer tests | `vi.mock()` — mock `complete` and `getModel` |
| File system           | Never                           | Use real temp directories (`os.tmpdir()`)    |
| tree-sitter           | Never                           | Use real native modules                      |
| globby                | Never                           | Use real implementation                      |

## Manual Test Checklist

The following checks still require manual verification because they depend on a real terminal, a real MCP client, or a live LLM provider.

### CLI Commands

- [ ] `kly init`: Interactive select provider → enter API key → enter model → verify `.kly/config.yaml`
- [ ] `kly init` cancel (Ctrl+C) exits cleanly
- [ ] `kly build`: Spinner shows progress; errors when not initialized
- [ ] `kly build`: Incremental mode skips unchanged files (default in git repos)
- [ ] `kly build --full`: Full rebuild re-indexes all files
- [ ] `kly mcp`: Starts from the packaged CLI in a real terminal session

### MCP Server

- [ ] Configure MCP client to connect to `kly mcp`
- [ ] Confirm a real MCP client can call `search_files`, `get_file_index`, and `get_overview`

### LLM Integration (requires real API key)

- [ ] Run `kly build` with a real API key on a small project, verify index content is meaningful
- [ ] Switch providers (openrouter/anthropic etc.) all work
- [ ] Network error behavior is acceptable
