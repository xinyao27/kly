# Task: Rename `kly serve` to `kly mcp`

## Plan

- [x] Check current branch and create a task branch for the CLI rename
- [x] Update the CLI command surface from `serve` to `mcp`
- [x] Update help text and user-facing descriptions for the MCP command
- [x] Sync README and Chinese/English docs to use `kly mcp`
- [x] Verify built CLI help output shows `mcp` and no longer shows `serve`
- [x] Review the final diff and record verification results

## Notes

- Scope: rename the public CLI command only
- Non-goal: keep a backward-compatible `serve` alias
- Internal implementation names may remain unchanged to keep the diff minimal

## Review

- Built the project with `npm run build`
- Verified `node dist/cli.mjs --help` lists `mcp` and no longer lists `serve`
- Verified `node dist/cli.mjs help mcp` shows the MCP command help text
- Verified there are no remaining public `kly serve` references in README or docs
