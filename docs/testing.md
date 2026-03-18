# kly Testing Documentation

**English** | [中文](testing.zh-CN.md)

## Testing Strategy

kly follows **TDD (Test-Driven Development)** — new features must have tests written first, then implementation. All automatable code must achieve **100% test coverage**.

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

Coverage is configured in `vite.config.ts` with 100% thresholds:

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

**Covered modules:** config, scanner, hasher, store, query, indexer, parser/_, llm/_

**Excluded from coverage:** CLI commands (`src/commands/`), MCP server (`src/mcp.ts`), entry points (`src/cli.ts`, `src/index.ts`)

## Mock Strategy

| Module                | When to mock                    | Method                                       |
| --------------------- | ------------------------------- | -------------------------------------------- |
| `@mariozechner/pi-ai` | LLMService tests, Indexer tests | `vi.mock()` — mock `complete` and `getModel` |
| File system           | Never                           | Use real temp directories (`os.tmpdir()`)    |
| tree-sitter           | Never                           | Use real native modules                      |
| globby                | Never                           | Use real implementation                      |

## Manual Test Checklist

The following tests require manual verification:

### CLI Commands

- [ ] `kly init`: Interactive select provider → enter API key → enter model → verify `.kly/config.yaml`
- [ ] `kly init` cancel (Ctrl+C) exits cleanly
- [ ] `kly build`: Spinner shows progress; errors when not initialized
- [ ] `kly build -i`: Incremental mode skips unchanged files
- [ ] `kly query "search term"`: Output format correct; warns when no results
- [ ] `kly show src/file.ts`: Shows full info; errors for non-existent files
- [ ] `kly mcp`: Starts without errors; errors when not initialized

### MCP Server

- [ ] Configure MCP client to connect to `kly mcp`
- [ ] `search_files` returns results
- [ ] `get_file_index` works for existing/non-existing paths
- [ ] `get_overview` returns language breakdown

### LLM Integration (requires real API key)

- [ ] Run `kly build` with a real API key on a small project, verify index.yaml content is meaningful
- [ ] Switch providers (openrouter/anthropic etc.) all work
- [ ] Network error behavior is acceptable
