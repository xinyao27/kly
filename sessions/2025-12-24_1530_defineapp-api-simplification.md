# Session: defineApp API Simplification

> Date: 2025-12-24 15:30
> Duration: ~1h

## Summary

Simplified the `defineApp` API to only accept `tools` array (removing inline `inputSchema` support). Implemented smart single-tool detection: when there's only one tool, the CLI behaves as a direct command without requiring subcommands.

## What We Did

- Removed `SingleToolAppDefinition` support from `defineApp` - now all tools must use `tool()` wrapper
- Renamed `MultiToolsAppDefinition` → `AppDefinition`, `ClaiMultiApp` → `ClaiApp`
- Removed `isMultiToolsApp` type guard (no longer needed)
- Removed `generateHelp` function (was for single tool inline mode)
- Added `generateSingleToolHelp` function for single-tool apps
- Implemented automatic mode detection based on `tools.length`:
  - `tools.length === 1`: Direct CLI mode (no subcommand needed)
  - `tools.length > 1`: Multi-command CLI mode (requires subcommand)
- Updated `examples/hello.ts` to use new API pattern
- All tests passing

## Current State

**New API Pattern:**
```typescript
const greetTool = tool({
  name: "greet",
  inputSchema: z.object({ name: z.string() }),
  execute: async ({ name }) => `Hello, ${name}!`,
});

defineApp({
  name: "hello",
  version: "0.1.0",
  description: "Hello CLI",
  tools: [greetTool],  // Must use tools array
});
```

**CLI Behavior:**
- Single tool: `bun run hello.ts --name=World` (direct, no subcommand)
- Multi tools: `bun run weather.ts current --city=Beijing` (requires subcommand)

## Next Steps

- [ ] Implement MCP mode support
- [ ] Add programmatic API tests
- [ ] Consider adding tool aliases/shortcuts
- [ ] Session management features (from roadmap)

## Key Files

- `src/define-app.ts` - Core defineApp function with single/multi tool detection
- `src/cli.ts` - CLI parsing and help generation (added `generateSingleToolHelp`)
- `src/types.ts` - Simplified types (`AppDefinition`, `ClaiApp`)
- `src/tool.ts` - Tool helper function (unchanged)
- `src/index.ts` - Public exports
- `examples/hello.ts` - Single tool example
- `examples/weather.ts` - Multi tools example

## Notes

- Dynamic help generation from JSON Schema (via Zod v4's `~standard.jsonSchema`) is working well
- The single-tool optimization provides a cleaner UX for simple CLIs while still supporting complex multi-command apps
- Type exports cleaned up: removed `SingleToolAppDefinition`, `ClaiMultiApp`, `MultiToolsAppDefinition`
