# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library starter template configured with modern tooling. The project uses Bun as its runtime and package manager, Oxc for linting and formatting, and tsdown for building.

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
bun run lint           # Run Oxc format + Oxc lint + type checking on ./src
bun run typecheck      # Type check only (no emit)
```

The `lint` script runs two tasks sequentially:

1. Oxc check with auto-fix on `./src` directory
2. TypeScript type checking

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

### Logging and Output

**Always Use the `log` Utility Instead of `console`**

This project uses a centralized logging system from `src/ui/components/log.ts` that leverages `@clack/prompts` for consistent, styled CLI output. Direct use of `console.*` methods is discouraged.

**Available Logging Functions:**

```typescript
import { log, output, error, help } from "../ui";

// Styled log messages (uses @clack/prompts)
log.info("Processing files...");        // Info messages
log.success("Build completed!");        // Success messages
log.warn("Config not found");           // Warning messages
log.step("Installing dependencies");    // Step indicators
log.message("General message");         // General output

// Output functions
output("Hello, world!");                // Simple text or JSON output
output({ name: "John", age: 30 });      // Auto-formats objects as JSON

// Error handling (use error() function, not log.error)
error("Failed to load config", [        // Error with suggestions
  "Check if config.json exists",
  "Verify JSON syntax"
]);

help("Usage: myapp <command>");         // Help text
```

**Bad Example:**

```typescript
console.log("Installing dependencies...");
console.warn("Config file not found");
console.error("Failed to load config");
```

**Good Example:**

```typescript
import { log, error } from "../ui";

log.step("Installing dependencies...");
log.warn("Config file not found");
error("Failed to load config");
```

**Why Use `log` Instead of `console`:**

- Consistent styling across the CLI using @clack/prompts
- Better visual hierarchy with icons and colors
- Centralized output management
- Easier to test and mock
- Better user experience

**Exceptions:**

- Test files may use `console` for debugging
- When explicitly testing console output behavior
- MCP mode error handlers (stderr only, as stdout is reserved for JSON-RPC)

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
