# Design: Rename `kly serve` to `kly mcp`

## Context

The CLI exposes an MCP server entrypoint via `kly serve`. The command works, but the name is generic and does not communicate the actual responsibility of the command as clearly as `kly mcp`.

## Decision

Rename the public CLI command from `kly serve` to `kly mcp`.

## Scope

- Update the top-level CLI command name in `src/cli.ts`
- Update user-facing documentation and examples to use `kly mcp`
- Update manual test checklists to reflect the new command name

## Non-Goals

- Do not keep a backward-compatible `serve` alias
- Do not rename internal implementation symbols such as `runServe` or `src/commands/serve.ts`

## Rationale

- `mcp` is more specific than `serve`
- The change improves discoverability in `kly --help`
- Keeping internal names unchanged minimizes code churn and risk

## Verification

- Rebuild the CLI bundle
- Confirm `kly --help` lists `mcp`
- Confirm `kly mcp --help` works
- Confirm no public docs still reference `kly serve`
