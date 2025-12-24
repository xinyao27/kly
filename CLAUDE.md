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

## Metadata Comment Standard

**IMPORTANT: Every new TypeScript or JavaScript file MUST start with an `agent-frontmatter` block.** This is a mandatory requirement for all code files in the project.

All TypeScript and JavaScript entry points should start with the sentinel-wrapped metadata block so agents and scripts can identify file purpose:

```ts
/* agent-frontmatter:start
AGENT: Agent runtime handler
PURPOSE: Route incoming messages through the agent class pipeline
USAGE: Import and mount inside the chosen template handler
EXPORTS: createAgentHandler
FEATURES:
  - Validates config
  - Streams token events
  - Dispatches tool executions
SEARCHABLE: agent handler, pipeline, runtime
agent-frontmatter:end */
```

Keep field names and ordering consistent across files. Expand `FEATURES` or `EXPORTS` only when relevant.

### Biome
- **Formatter**: 2 spaces, line width 80, double quotes for JS
- **Linter**: Uses recommended rules with specific customizations:
  - a11y rules disabled
  - `noExplicitAny`, `noNonNullAssertion` disabled
  - Auto-organizes imports
  - Supports Tailwind directives in CSS

### TypeScript
- Type checking runs as part of `lint` script

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
