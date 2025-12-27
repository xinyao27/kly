# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library starter template configured with modern tooling. The project uses Bun as its runtime and package manager, Biome for linting and formatting, and tsdown for building.

## Development Commands

### Building
```bash
bun run build          # Build the library using tsdown
```

The build outputs to `dist/` with three formats:
- `dist/index.cjs` (CommonJS)
- `dist/index.mjs` (ESM)
- `dist/index.d.ts` (TypeScript declarations)

### Linting
```bash
bun run lint           # Run Biome formatter + type checking on ./src
bun run typecheck      # Type check only (no emit)
```

The `lint` script runs two tasks sequentially:
1. Biome check with auto-fix on `./src` directory
2. TypeScript type checking

Note: Git pre-commit hooks run `biome check --write --unsafe` on all staged files via lint-staged.

### Testing
```bash
bun test               # Run tests using Bun's built-in test runner
```

### Development
```bash
bun run start          # Run src/index.ts directly
```

### Releasing
```bash
bun run release        # Interactive release using release-it with conventional changelog
```

Release configuration follows Angular conventional commits. Changelog is auto-generated in CHANGELOG.md.

### Dependencies
```bash
bun run up             # Update dependencies to latest major versions using taze
```

## Code Quality Configuration

## Coding Guidelines

### Import Preferences

**Avoid Dynamic Imports Unless Necessary**

Prefer static imports over dynamic imports (`await import(...)`) unless there's a specific reason:
- Module is only needed in certain runtime modes (e.g., MCP vs CLI)
- Lazy loading is required for performance
- Circular dependency issues need to be resolved

**Bad Example:**
```typescript
if (command === "models") {
  const { modelsCommand } = await import("../src/ai/models-command");
  await modelsCommand();
}
```

**Good Example:**
```typescript
import { modelsCommand } from "../src/ai/models-command";

if (command === "models") {
  await modelsCommand();
}
```

**Acceptable Use Cases:**
- MCP server module in defineApp (only loaded when needed in MCP mode)
- Large dependencies that are rarely used
- Runtime-specific modules

## Project Structure

- `src/` - Source TypeScript files (currently minimal starter code)
- `dist/` - Build output (generated, not committed)
- Entry point: `src/index.ts`

## Build System

Uses `tsdown` (configured in `tsdown.config.ts`):
- Cleans dist directory before build
- Generates TypeScript declarations
- Outputs dual-format bundles (CJS + ESM)

## CI/CD

GitHub Actions workflows:
- **Lint**: Runs on push/PR to main, executes `bun run lint`
- **Test**: Runs on push/PR to main across Ubuntu/Windows/macOS, executes build + test

## Git Workflow

- Main branch: `main`
- Pre-commit hook: Runs Biome formatting on staged files
- Commit message format: Conventional commits (Angular preset) for release automation
